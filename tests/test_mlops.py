import io
import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import journal  # noqa: E402
import metriques  # noqa: E402
import modele_risque  # noqa: E402
import registre  # noqa: E402
import surveillance_modele as surveillance  # noqa: E402
from jeu_synthetique import mensuel_synthetique  # noqa: E402
from risque import VARIABLES, grille, observations_courantes, scorer  # noqa: E402


@pytest.fixture(scope="module")
def pipeline(tmp_path_factory):
    dossier = tmp_path_factory.mktemp("registre")
    return dossier, modele_risque.executer_pipeline(mensuel_synthetique(), dossier)


def evaluation(auc_arbre, auc_regle, bas=None, departs=50):
    return {
        "entrainement": {"departs": departs},
        "resultats": [
            {"modele": "Règle simple", "auc": auc_regle, "auc_ic95": [auc_regle - 0.05, auc_regle + 0.05]},
            {"modele": "Arbre de décision", "auc": auc_arbre, "auc_ic95": [bas if bas is not None else auc_arbre - 0.04, auc_arbre + 0.04]},
        ],
    }


def test_pipeline_promeut_un_modele_valide(pipeline):
    dossier, resultat = pipeline
    assert resultat["accepte"] and resultat["raisons"] == []
    index = registre.lire_index(dossier)
    assert index["production"] == resultat["version"]
    modele, informations = registre.charger_production(dossier)
    assert informations["variables"] == VARIABLES and "arbre" in modele
    assert informations["empreinte_jeu"] and informations["nb_departs"] > 0


def test_meta_contient_les_distributions_de_reference(pipeline):
    dossier, resultat = pipeline
    informations = registre.meta(resultat["version"], dossier)
    for variable in VARIABLES:
        reference = informations["distributions"][variable]
        assert abs(sum(reference["proportions"]) - 1) < 1e-9


def test_porte_refuse_un_modele_qui_ne_bat_pas_la_regle():
    ok, raisons = registre.evaluer_porte(evaluation(0.65, 0.62), None)
    assert not ok and any("règle simple" in r for r in raisons)


def test_porte_refuse_trop_peu_de_departs():
    ok, raisons = registre.evaluer_porte(evaluation(0.9, 0.6, departs=5), None)
    assert not ok and any("départs" in r for r in raisons)


def test_porte_refuse_une_regression_par_rapport_a_la_production():
    production = {"resultats": evaluation(0.88, 0.6)["resultats"]}
    ok, raisons = registre.evaluer_porte(evaluation(0.80, 0.6), production)
    assert not ok and any("régression" in r for r in raisons)


def test_un_modele_refuse_ne_remplace_pas_la_production(pipeline):
    dossier, premier = pipeline
    version = registre.enregistrer(
        registre.charger_production(dossier)[0], {"entrainement": {"departs": 1}, "test": {}, "resultats": []}, mensuel_candidat(), VARIABLES, {}, dossier
    )
    registre.statuer(version, False, ["test"], dossier)
    assert registre.lire_index(dossier)["production"] == premier["version"]
    assert any(h["version"] == version and h["statut"] == "refuse" for h in registre.lire_index(dossier)["historique"])


def mensuel_candidat():
    jeu = pd.DataFrame({v: np.arange(20, dtype=float) for v in VARIABLES})
    jeu["depart"] = [0, 1] * 10
    return jeu


def test_psi_nul_sur_la_meme_distribution_et_fort_apres_decalage():
    valeurs = np.random.default_rng(0).normal(100, 10, 5000)
    bornes = list(np.unique(np.quantile(valeurs, np.linspace(0.1, 0.9, 9))))
    classes = np.digitize(valeurs, bornes)
    attendues = list(np.bincount(classes, minlength=len(bornes) + 1) / len(valeurs))
    assert surveillance.psi(bornes, attendues, valeurs) < 0.01
    assert surveillance.psi(bornes, attendues, valeurs + 25) > surveillance.SEUIL_ALERTE


def test_statuts_de_derive():
    assert surveillance.statut_psi(0.05) == "ok"
    assert surveillance.statut_psi(0.15) == "attention"
    assert surveillance.statut_psi(0.30) == "alerte"


def test_mesures_de_surveillance_sur_donnees_stables_et_derivees(pipeline):
    dossier, _ = pipeline
    modele, informations = registre.charger_production(dossier)
    clients, periodes, ca, nb, groupe = grille(mensuel_synthetique())
    observations = observations_courantes(clients, ca, nb, groupe, len(periodes) - 1)
    stables = surveillance.mesurer(informations, observations, scorer(modele, observations))
    assert next(m for m in stables if m["indicateur"] == "psi_max")["statut"] in {"ok", "attention"}
    decalees = observations.assign(ca_moyen_6m=observations["ca_moyen_6m"] * 6, ca_3m=observations["ca_3m"] * 6, ca_1m=observations["ca_1m"] * 6)
    mesures = surveillance.mesurer(informations, decalees, scorer(modele, decalees))
    assert next(m for m in mesures if m["indicateur"] == "psi_max")["statut"] == "alerte"


def test_precision_realisee_necessite_assez_de_cas_murs():
    mensuel = mensuel_synthetique()
    clients, periodes, ca, nb, groupe = grille(mensuel)
    periode_ancienne = int(periodes[8])
    modele_fictif = pd.DataFrame({"periode": periode_ancienne, "tiers_id": list(range(1, 261)), "probabilite": np.random.default_rng(1).random(260)})
    resultat = surveillance.precision_realisee(modele_fictif, mensuel)
    assert resultat is not None and 0 <= resultat["auc"] <= 1
    recent = modele_fictif.assign(periode=int(periodes[-2]))
    assert surveillance.precision_realisee(recent, mensuel) is None


def test_journal_est_du_json_structure(monkeypatch):
    monkeypatch.setenv("SERVICE", "test")
    flux = io.StringIO()
    logger = logging.getLogger("test_journal")
    gestionnaire = logging.StreamHandler(flux)
    gestionnaire.setFormatter(journal.FormatJson())
    logger.addHandler(gestionnaire)
    logger.setLevel(logging.INFO)
    journal.evenement(logger, "chargement", route="sage/ca", lignes=3)
    ligne = json.loads(flux.getvalue())
    assert ligne["evenement"] == "chargement" and ligne["service"] == "test" and ligne["lignes"] == 3
    assert ligne["niveau"] == "info" and ligne["horodatage"].endswith("Z")


def test_metriques_http_et_journal_des_requetes():
    app = FastAPI()
    metriques.installer(app, "service-test")

    @app.get("/bonjour")
    def bonjour():
        return {"ok": True}

    client = TestClient(app)
    assert client.get("/bonjour").status_code == 200
    reponse = client.get("/metrics")
    assert reponse.status_code == 200
    assert 'requetes_total{code="200",methode="GET",route="/bonjour",service="service-test"}' in reponse.text
    assert "duree_requete_secondes_bucket" in reponse.text
    assert client.get("/bonjour").headers["x-request-id"]
