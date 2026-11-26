import json
import os
import sys
import time

import numpy as np
import pandas as pd
import psycopg
from sklearn.metrics import roc_auc_score

import registre
from journal import chronometre, evenement, journal
from risque import HORIZON, NOMS, grille, observations_courantes, scorer

SEUIL_ATTENTION = 0.10
SEUIL_ALERTE = 0.25
MIN_PRECISION = 30


def psi(bornes: list[float], attendues: list[float], valeurs: np.ndarray) -> float:
    classes = np.digitize(valeurs, np.array(bornes))
    observees = np.bincount(classes, minlength=len(bornes) + 1) / max(len(valeurs), 1)
    a = np.clip(observees, 1e-4, None)
    e = np.clip(np.array(attendues), 1e-4, None)
    return float(np.sum((a - e) * np.log(a / e)))


def statut_psi(valeur: float) -> str:
    return "alerte" if valeur >= SEUIL_ALERTE else "attention" if valeur >= SEUIL_ATTENTION else "ok"


def mesurer(informations: dict, observations: pd.DataFrame, scores: pd.DataFrame) -> list[dict]:
    mesures = []
    for variable in informations["variables"]:
        reference = informations["distributions"][variable]
        valeur = psi(reference["bornes"], reference["proportions"], observations[variable].to_numpy(dtype=float))
        mesures.append({"indicateur": f"psi:{variable}", "valeur": round(valeur, 5), "statut": statut_psi(valeur), "detail": NOMS.get(variable, variable)})
    part_elevee = float((scores["niveau"] == "élevé").mean()) if len(scores) else 0.0
    mesures.append({"indicateur": "part_risque_eleve", "valeur": round(part_elevee, 5), "statut": "ok", "detail": "Part des clients scorés au niveau élevé"})
    mesures.append({"indicateur": "clients_scores", "valeur": float(len(scores)), "statut": "ok", "detail": "Clients récurrents scorés"})
    pire = max((m["valeur"] for m in mesures if m["indicateur"].startswith("psi:")), default=0.0)
    mesures.append({"indicateur": "psi_max", "valeur": round(pire, 5), "statut": statut_psi(pire), "detail": "Dérive maximale parmi les variables"})
    return mesures


def precision_realisee(instantanes: pd.DataFrame, mensuel: pd.DataFrame) -> dict | None:
    periodes = sorted(mensuel["periode"].unique())
    derniere = periodes[-2] if len(periodes) > 1 else periodes[-1]
    actifs = mensuel[mensuel["ca_ht"] > 0].groupby("tiers_id")["periode"].apply(set).to_dict()
    lignes = []
    for r in instantanes.itertuples():
        suivants = [p for p in periodes if p > r.periode][:HORIZON]
        if len(suivants) < HORIZON or suivants[-1] > derniere:
            continue
        depart = int(not any(p in actifs.get(r.tiers_id, set()) for p in suivants))
        lignes.append((float(r.probabilite), depart))
    if len(lignes) < MIN_PRECISION or len({d for _, d in lignes}) < 2:
        return None
    y = np.array([d for _, d in lignes])
    return {"auc": round(float(roc_auc_score(y, [p for p, _ in lignes])), 3), "observations": len(lignes), "departs": int(y.sum())}


def connexion():
    return psycopg.connect(
        host=os.getenv("PG_HOTE", "localhost"),
        port=os.getenv("PG_PORT", "5442"),
        dbname=os.getenv("PG_BASE", "entrepot"),
        user=os.getenv("PG_UTILISATEUR", "entrepot"),
        password=os.getenv("PG_MOT_DE_PASSE", ""),
    )


def ecrire_base(c, version: str, periode: int, scores: pd.DataFrame, mesures: list[dict]) -> None:
    aujourdhui = time.strftime("%Y-%m-%d")
    c.execute("DELETE FROM supervision.score_historique WHERE date_score = %s AND version = %s", (aujourdhui, version))
    with c.cursor() as curseur:
        curseur.executemany(
            "INSERT INTO supervision.score_historique (date_score, periode, version, tiers_id, probabilite, niveau)"
            " VALUES (%s, %s, %s, %s, %s, %s)",
            [(aujourdhui, periode, version, int(r.tiers_id), float(r.probabilite), r.niveau) for r in scores.itertuples()],
        )
    c.execute("DELETE FROM supervision.modele_surveillance WHERE date_mesure = %s AND version = %s", (aujourdhui, version))
    with c.cursor() as curseur:
        curseur.executemany(
            "INSERT INTO supervision.modele_surveillance (date_mesure, version, indicateur, valeur, statut, detail)"
            " VALUES (%s, %s, %s, %s, %s, %s)",
            [(aujourdhui, version, m["indicateur"], m["valeur"], m["statut"], m["detail"]) for m in mesures],
        )


def main() -> int:
    os.environ.setdefault("SERVICE", "surveillance-modele")
    logger = journal("surveillance")
    from modele_risque import charger

    modele, informations = registre.charger_production()
    mensuel = charger()
    clients, periodes, ca, nb, groupe = grille(mensuel)
    t = len(periodes) - 1
    observations = observations_courantes(clients, ca, nb, groupe, t)
    scores = scorer(modele, observations)
    mesures = mesurer(informations, observations, scores)
    with connexion() as c:
        instantanes = pd.read_sql_query(
            "SELECT periode, tiers_id, probabilite FROM supervision.score_historique WHERE version = %s", c, params=(informations["version"],)
        )
        realise = precision_realisee(instantanes, mensuel) if len(instantanes) else None
        if realise:
            mesures.append({"indicateur": "auc_realise", "valeur": realise["auc"], "statut": "ok", "detail": f"{realise['observations']} observations arrivées à maturité"})
        with chronometre(logger, "ecriture_surveillance", version=informations["version"]):
            ecrire_base(c, informations["version"], int(periodes[t - 1]), scores, mesures)
    for m in mesures:
        evenement(logger, "indicateur_modele", "warning" if m["statut"] != "ok" else "info", version=informations["version"], **m)
    print(json.dumps({"version": informations["version"], "mesures": mesures}, ensure_ascii=False, indent=1))
    return 1 if any(m["statut"] == "alerte" for m in mesures) else 0


if __name__ == "__main__":
    sys.exit(main())
