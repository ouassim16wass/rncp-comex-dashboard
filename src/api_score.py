import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from prometheus_client import Gauge

import registre
from journal import journal
from metriques import installer
from risque import VARIABLES, explication, grille, observations_courantes, scorer

RACINE = Path(__file__).resolve().parent.parent
CLE = os.getenv("API_CLE", "")
DOSSIER_REGISTRE = Path(os.getenv("REGISTRE_MODELES", RACINE / "models" / "registre"))
DUREE_CACHE = int(os.getenv("DUREE_CACHE_S", "300"))

os.environ.setdefault("SERVICE", "api-score")
logger = journal("api-score")
app = FastAPI(title="API de score de risque de départ", version="1.1")
_cache: dict = {"instant": 0.0, "valeur": None}


def connexion():
    return psycopg.connect(
        host=os.getenv("PG_HOTE", "localhost"),
        port=os.getenv("PG_PORT", "5442"),
        dbname=os.getenv("PG_BASE", "entrepot"),
        user=os.getenv("PG_UTILISATEUR", "entrepot"),
        password=os.getenv("PG_MOT_DE_PASSE", ""),
    )


def calculer_scores():
    modele, informations = registre.charger_production(DOSSIER_REGISTRE)
    modele["version"] = informations["version"]
    with connexion() as c:
        mensuel = c.execute(
            "select tiers_id, periode, ca_ht, nb_factures, segment from marts.mart_client_mensuel"
        ).fetchall()
        noms = c.execute("select tiers_id, code_sage, raison_sociale_pseudo from dwh.dim_tiers").fetchall()
    mensuel = pd.DataFrame(mensuel, columns=["tiers_id", "periode", "ca_ht", "nb_factures", "segment"]).astype(
        {"ca_ht": float, "nb_factures": float}
    )
    noms = pd.DataFrame(noms, columns=["tiers_id", "code_sage", "nom"])
    clients, periodes, ca, nb, groupe = grille(mensuel)
    t = len(periodes) - 1
    scores = scorer(modele, observations_courantes(clients, ca, nb, groupe, t))
    scores = scores.merge(noms, on="tiers_id", how="left")
    scores["periode"] = int(periodes[t - 1])
    return scores.sort_values(["probabilite", "ca_annuel"], ascending=False).reset_index(drop=True), modele


def scores_courants():
    if _cache["valeur"] is None or time.time() - _cache["instant"] > DUREE_CACHE:
        _cache["valeur"], _cache["instant"] = calculer_scores(), time.time()
    return _cache["valeur"]


def verifier_cle(x_api_key: str = Header(default="")):
    if not CLE or x_api_key != CLE:
        raise HTTPException(status_code=401, detail="Clé d'API absente ou invalide")


def ligne_client(ligne) -> dict:
    return {
        "tiers_id": int(ligne["tiers_id"]),
        "code_sage": ligne["code_sage"],
        "nom": ligne["nom"],
        "probabilite_depart": round(float(ligne["probabilite"]), 4),
        "niveau": ligne["niveau"],
        "ca_annuel": round(float(ligne["ca_annuel"]), 2),
        "periode": int(ligne["periode"]),
    }


JAUGE_MODELE = Gauge("modele_en_production", "Modèle en production (valeur 1)", ["version"])
JAUGE_PSI = Gauge("modele_psi", "Dérive d'une variable par rapport à l'entraînement", ["variable"])
JAUGE_NIVEAU = Gauge("clients_scores", "Clients scorés par niveau de risque", ["niveau"])
JAUGE_AUC = Gauge("modele_auc_evaluation", "AUC de l'arbre sur la période de test")


def mettre_a_jour_jauges():
    try:
        meta = registre.meta_production(DOSSIER_REGISTRE)
        if meta:
            JAUGE_MODELE.labels(meta["version"]).set(1)
            JAUGE_AUC.set(registre.resultat({"resultats": meta["resultats"]}, "Arbre de décision")["auc"])
        scores, _ = scores_courants()
        for niveau in ("élevé", "moyen", "faible"):
            JAUGE_NIVEAU.labels(niveau).set(int((scores["niveau"] == niveau).sum()))
        with connexion() as c:
            lignes = c.execute(
                "SELECT indicateur, valeur FROM supervision.modele_surveillance WHERE date_mesure = "
                "(SELECT max(date_mesure) FROM supervision.modele_surveillance) AND indicateur LIKE 'psi:%'"
            ).fetchall()
        for indicateur, valeur in lignes:
            JAUGE_PSI.labels(indicateur.split(":", 1)[1]).set(float(valeur))
    except Exception:
        logger.warning("jauges_indisponibles", extra={"champs": {}})


installer(app, "api-score", mettre_a_jour_jauges)


@app.get("/sante")
def sante():
    index = registre.lire_index(DOSSIER_REGISTRE)
    return {"etat": "ok" if index["production"] else "degrade", "modele_en_production": index["production"]}


@app.get("/modele", dependencies=[Depends(verifier_cle)])
def modele_info():
    scores, modele = scores_courants()
    meta = registre.meta_production(DOSSIER_REGISTRE) or {}
    return {
        "version": modele.get("version"),
        "date_creation": meta.get("date_creation"),
        "commit_git": meta.get("commit_git"),
        "type": "arbre de décision",
        "profondeur": int(modele["arbre"].get_depth()),
        "variables": VARIABLES,
        "taux_de_base": round(float(modele["taux_de_base"]), 4),
        "seuils": {k: round(float(v), 4) for k, v in modele["seuils"].items()},
        "evaluation": meta.get("resultats", []),
        "entrainement": meta.get("entrainement"),
        "test": meta.get("test"),
    }


@app.get("/registre", dependencies=[Depends(verifier_cle)])
def registre_modeles():
    index = registre.lire_index(DOSSIER_REGISTRE)
    return {"production": index["production"], "historique": list(reversed(index["historique"]))}


@app.get("/surveillance", dependencies=[Depends(verifier_cle)])
def surveillance():
    with connexion() as c:
        lignes = c.execute(
            "SELECT to_char(date_mesure, 'YYYY-MM-DD'), version, indicateur, valeur::float8, statut, detail "
            "FROM supervision.modele_surveillance WHERE date_mesure = (SELECT max(date_mesure) FROM supervision.modele_surveillance) "
            "ORDER BY indicateur"
        ).fetchall()
        nb = c.execute("SELECT count(DISTINCT date_score) FROM supervision.score_historique").fetchone()[0]
    return {
        "mesures": [{"date": d, "version": v, "indicateur": i, "valeur": x, "statut": s, "detail": t} for d, v, i, x, s, t in lignes],
        "instantanes_conserves": int(nb),
    }


@app.get("/synthese", dependencies=[Depends(verifier_cle)])
def synthese():
    scores, _ = scores_courants()
    total = float(scores["ca_annuel"].sum())
    par_niveau = {}
    for niveau in ("élevé", "moyen", "faible"):
        sous = scores[scores["niveau"] == niveau]
        par_niveau[niveau] = {
            "clients": int(len(sous)),
            "ca_annuel": round(float(sous["ca_annuel"].sum()), 2),
            "part_du_ca": round(float(sous["ca_annuel"].sum()) / total, 4) if total else 0.0,
        }
    return {"periode": int(scores["periode"].iloc[0]) if len(scores) else None, "clients_scores": int(len(scores)), "niveaux": par_niveau}


@app.get("/scores", dependencies=[Depends(verifier_cle)])
def lister_scores(niveau: str | None = Query(None, pattern="^(élevé|moyen|faible)$"), limite: int = Query(50, ge=1, le=500)):
    scores, _ = scores_courants()
    if niveau:
        scores = scores[scores["niveau"] == niveau]
    return {"total": int(len(scores)), "clients": [ligne_client(r) for _, r in scores.head(limite).iterrows()]}


@app.get("/clients/{tiers_id}/score", dependencies=[Depends(verifier_cle)])
def score_client(tiers_id: int):
    scores, modele = scores_courants()
    trouve = scores[scores["tiers_id"] == tiers_id]
    if trouve.empty:
        raise HTTPException(status_code=404, detail="Client non scoré : il n'est pas récurrent à cette date")
    ligne = trouve.iloc[0]
    valeurs = np.array([ligne[v] for v in VARIABLES], dtype=float)
    return {**ligne_client(ligne), "regles": explication(modele["arbre"], valeurs)}
