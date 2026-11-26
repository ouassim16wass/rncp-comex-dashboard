import hashlib
import json
import os
import subprocess
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

RACINE = Path(__file__).resolve().parent.parent
REGISTRE = Path(os.getenv("REGISTRE_MODELES", RACINE / "models" / "registre"))

PORTE = {"ecart_auc_regle": 0.10, "min_departs": 20, "regression_max": 0.02}


def sha_git() -> str:
    if os.getenv("GIT_SHA"):
        return os.environ["GIT_SHA"][:8]
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short=8", "HEAD"], capture_output=True, text=True, cwd=RACINE, timeout=5, check=True
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return "inconnu"


def empreinte_jeu(jeu: pd.DataFrame, variables: list[str]) -> str:
    valeurs = jeu[variables + ["depart"]].round(6).sort_values(variables + ["depart"]).to_csv(index=False)
    return hashlib.sha256(valeurs.encode("utf-8")).hexdigest()[:16]


def distributions(jeu: pd.DataFrame, variables: list[str]) -> dict:
    sortie = {}
    for v in variables:
        valeurs = jeu[v].to_numpy(dtype=float)
        bornes = np.unique(np.quantile(valeurs, np.linspace(0.1, 0.9, 9)))
        classes = np.digitize(valeurs, bornes)
        proportions = np.bincount(classes, minlength=len(bornes) + 1) / len(valeurs)
        sortie[v] = {"bornes": [float(b) for b in bornes], "proportions": [float(p) for p in proportions]}
    return sortie


def lire_index(dossier: Path = REGISTRE) -> dict:
    chemin = Path(dossier) / "registre.json"
    if not chemin.exists():
        return {"production": None, "historique": []}
    return json.loads(chemin.read_text(encoding="utf-8"))


def ecrire_index(index: dict, dossier: Path = REGISTRE) -> None:
    Path(dossier).mkdir(parents=True, exist_ok=True)
    (Path(dossier) / "registre.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")


def meta(version: str, dossier: Path = REGISTRE) -> dict:
    return json.loads((Path(dossier) / version / "meta.json").read_text(encoding="utf-8"))


def meta_production(dossier: Path = REGISTRE) -> dict | None:
    version = lire_index(dossier)["production"]
    return meta(version, dossier) if version else None


def enregistrer(modele: dict, evaluation: dict, jeu: pd.DataFrame, variables: list[str], parametres: dict, dossier: Path = REGISTRE) -> str:
    horodatage = time.strftime("%Y%m%d-%H%M%S")
    empreinte = empreinte_jeu(jeu, variables)
    version = f"v{horodatage}-{empreinte[:6]}"
    cible = Path(dossier) / version
    cible.mkdir(parents=True, exist_ok=True)
    joblib.dump(modele, cible / "modele.pkl")
    informations = {
        "version": version,
        "date_creation": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "commit_git": sha_git(),
        "empreinte_jeu": empreinte,
        "parametres": parametres,
        "variables": variables,
        "entrainement": evaluation["entrainement"],
        "test": evaluation["test"],
        "resultats": evaluation["resultats"],
        "taux_de_base": modele["taux_de_base"],
        "seuils": modele["seuils"],
        "distributions": distributions(jeu, variables),
        "nb_observations": int(len(jeu)),
        "nb_departs": int(jeu["depart"].sum()),
    }
    (cible / "meta.json").write_text(json.dumps(informations, ensure_ascii=False, indent=1), encoding="utf-8")
    index = lire_index(dossier)
    index["historique"].append({"version": version, "date": informations["date_creation"], "statut": "candidat", "raison": ""})
    ecrire_index(index, dossier)
    return version


def resultat(evaluation: dict, nom: str) -> dict:
    return next(r for r in evaluation["resultats"] if r["modele"] == nom)


def evaluer_porte(evaluation: dict, production: dict | None, porte: dict = PORTE) -> tuple[bool, list[str]]:
    arbre = resultat(evaluation, "Arbre de décision")
    regle = resultat(evaluation, "Règle simple")
    raisons = []
    if evaluation["entrainement"]["departs"] < porte["min_departs"]:
        raisons.append(f"moins de {porte['min_departs']} départs à l'entraînement ({evaluation['entrainement']['departs']})")
    if arbre["auc"] - regle["auc"] < porte["ecart_auc_regle"]:
        raisons.append(f"AUC de l'arbre ({arbre['auc']}) à moins de {porte['ecart_auc_regle']} de la règle simple ({regle['auc']})")
    if arbre["auc_ic95"][0] <= regle["auc"]:
        raisons.append("borne basse de l'intervalle de l'arbre sous l'AUC de la règle simple")
    if production:
        ancien = resultat({"resultats": production["resultats"]}, "Arbre de décision")
        if arbre["auc"] < ancien["auc"] - porte["regression_max"]:
            raisons.append(f"régression de l'AUC par rapport à la production ({ancien['auc']} vers {arbre['auc']})")
    return (not raisons), raisons


def statuer(version: str, accepte: bool, raisons: list[str], dossier: Path = REGISTRE) -> None:
    index = lire_index(dossier)
    for ligne in index["historique"]:
        if ligne["version"] == version:
            ligne["statut"] = "production" if accepte else "refuse"
            ligne["raison"] = "porte qualité franchie" if accepte else " ; ".join(raisons)
        elif accepte and ligne["statut"] == "production":
            ligne["statut"] = "archive"
    if accepte:
        index["production"] = version
    ecrire_index(index, dossier)


def charger_production(dossier: Path = REGISTRE) -> tuple[dict, dict]:
    version = lire_index(dossier)["production"]
    if not version:
        raise FileNotFoundError("Aucun modèle en production dans le registre")
    return joblib.load(Path(dossier) / version / "modele.pkl"), meta(version, dossier)
