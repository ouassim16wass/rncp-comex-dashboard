import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.tree import DecisionTreeClassifier

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import api_score  # noqa: E402
import risque  # noqa: E402


def jeu_synthetique():
    lignes = []
    for client in range(1, 41):
        mois = list(range(1, 13)) if client % 2 == 0 else [1, 2, 3, 4, 6, 8]
        for m in mois:
            montant = 1000.0 if client % 2 == 0 else 1000.0 / (1 + m)
            lignes.append((client, 202500 + m, montant, 2, "Groupe" if client % 4 == 0 else "Hors groupe"))
    return pd.DataFrame(lignes, columns=["tiers_id", "periode", "ca_ht", "nb_factures", "segment"])


@pytest.fixture()
def modele_et_scores():
    clients, periodes, ca, nb, groupe = risque.grille(jeu_synthetique())
    jeu = risque.construire(clients, ca, nb, groupe, 12)
    arbre = DecisionTreeClassifier(max_depth=3, min_samples_leaf=3, class_weight="balanced", random_state=0).fit(
        jeu[risque.VARIABLES].to_numpy(), jeu["depart"]
    )
    taux, base = risque.taux_par_feuille(arbre, jeu[risque.VARIABLES].to_numpy(), jeu["depart"])
    modele = {"arbre": arbre, "taux_feuilles": taux, "taux_de_base": base, "seuils": {"eleve": 2 * base, "moyen": base}}
    scores = risque.scorer(modele, risque.observations_courantes(clients, ca, nb, groupe, 8))
    scores = scores.assign(code_sage="C" + scores["tiers_id"].astype(str), nom="Client", periode=202508)
    return modele, scores.sort_values("probabilite", ascending=False).reset_index(drop=True)


def test_construction_sans_fuite_du_futur():
    clients, periodes, ca, nb, groupe = risque.grille(jeu_synthetique())
    jeu = risque.construire(clients, ca, nb, groupe, 12)
    assert jeu["t"].max() == 12 - risque.HORIZON
    assert set(jeu["depart"].unique()) == {0, 1}


def test_clients_irreguliers_plus_risques(modele_et_scores):
    _, scores = modele_et_scores
    irreguliers = scores[scores["tiers_id"] % 2 == 1]["probabilite"].mean()
    reguliers = scores[scores["tiers_id"] % 2 == 0]["probabilite"].mean()
    assert irreguliers > reguliers


def test_explication_decrit_le_chemin(modele_et_scores):
    modele, scores = modele_et_scores
    ligne = scores.iloc[0]
    regles = risque.explication(modele["arbre"], np.array([ligne[v] for v in risque.VARIABLES], dtype=float))
    assert regles and {"variable", "valeur", "condition"} <= set(regles[0])


@pytest.fixture()
def client_api(monkeypatch, modele_et_scores):
    modele, scores = modele_et_scores
    monkeypatch.setattr(api_score, "scores_courants", lambda: (scores, modele))
    return TestClient(api_score.app)


def test_api_exige_la_cle(client_api):
    assert client_api.get("/scores").status_code == 401


def test_api_liste_et_filtre(client_api):
    entetes = {"X-API-Key": api_score.CLE}
    tout = client_api.get("/scores", headers=entetes).json()
    assert tout["total"] > 0 and tout["clients"][0]["probabilite_depart"] >= tout["clients"][-1]["probabilite_depart"]
    eleves = client_api.get("/scores", params={"niveau": "élevé"}, headers=entetes).json()
    assert all(c["niveau"] == "élevé" for c in eleves["clients"])


def test_api_detail_client_et_404(client_api):
    entetes = {"X-API-Key": api_score.CLE}
    detail = client_api.get("/clients/1/score", headers=entetes).json()
    assert detail["tiers_id"] == 1 and detail["regles"]
    assert client_api.get("/clients/99999/score", headers=entetes).status_code == 404


def test_api_synthese(client_api):
    synthese = client_api.get("/synthese", headers={"X-API-Key": api_score.CLE}).json()
    assert synthese["clients_scores"] == sum(n["clients"] for n in synthese["niveaux"].values())
