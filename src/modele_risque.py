import json
import math
import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import psycopg
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.tree import DecisionTreeClassifier, plot_tree

import registre
from journal import chronometre, evenement, journal
from risque import HORIZON, NOMS, VARIABLES, construire, grille, taux_par_feuille

RACINE = Path(__file__).resolve().parent.parent
MODELES = Path(os.getenv("DOSSIER_MODELES", RACINE / "models"))
FIGURES = Path(os.getenv("DOSSIER_FIGURES", RACINE / "docs" / "figures"))

ECART_FIN_ENTRAINEMENT = 8
ECART_DEBUT_TEST = 5
SEUIL_ELEVE = 0.30
SEUIL_MOYEN = 0.10


def charger() -> pd.DataFrame:
    connexion = psycopg.connect(
        host=os.getenv("PG_HOTE", "localhost"),
        port=os.getenv("PG_PORT", "5442"),
        dbname=os.getenv("PG_BASE", "entrepot"),
        user=os.getenv("PG_UTILISATEUR", "entrepot"),
        password=os.getenv("PG_MOT_DE_PASSE", ""),
    )
    with connexion:
        lignes = connexion.execute(
            "select tiers_id, periode, ca_ht, nb_factures, segment from marts.mart_client_mensuel"
        ).fetchall()
    return pd.DataFrame(lignes, columns=["tiers_id", "periode", "ca_ht", "nb_factures", "segment"]).astype(
        {"ca_ht": float, "nb_factures": float}
    )


def precision_rappel_haut(y, score, part=0.10):
    k = max(1, math.ceil(part * len(y)))
    ordre = np.argsort(-score, kind="stable")[:k]
    retenus = y[ordre]
    return retenus.mean(), retenus.sum() / y.sum() if y.sum() else float("nan"), ordre


def ca_detecte(y, ca_annuel, ordre):
    positifs = y == 1
    detecte = np.zeros(len(y), dtype=bool)
    detecte[ordre] = True
    total = ca_annuel[positifs].sum()
    return ca_annuel[positifs & detecte].sum() / total if total else float("nan")


def intervalle_auc(y, score, tirages=300):
    rng = np.random.default_rng(0)
    valeurs = []
    for _ in range(tirages):
        idx = rng.integers(0, len(y), len(y))
        if y[idx].min() == y[idx].max():
            continue
        valeurs.append(roc_auc_score(y[idx], score[idx]))
    return np.percentile(valeurs, [2.5, 97.5])


def choisir_hyperparametres(entrainement: pd.DataFrame, fin_entrainement: int):
    meilleurs, meilleur_score = None, -1
    for profondeur in (2, 3, 4):
        for feuille in (20, 50):
            scores = []
            for limite in (fin_entrainement - 3, fin_entrainement - 2, fin_entrainement - 1):
                appris = entrainement[entrainement["t"] <= limite - 3]
                valide = entrainement[(entrainement["t"] > limite - 3) & (entrainement["t"] <= limite)]
                if valide["depart"].sum() == 0 or appris["depart"].sum() == 0:
                    continue
                arbre = DecisionTreeClassifier(
                    max_depth=profondeur, min_samples_leaf=feuille, class_weight="balanced", random_state=0
                ).fit(appris[VARIABLES], appris["depart"])
                scores.append(average_precision_score(valide["depart"], arbre.predict_proba(valide[VARIABLES])[:, 1]))
            moyenne = float(np.mean(scores)) if scores else -1
            if moyenne > meilleur_score:
                meilleurs, meilleur_score = (profondeur, feuille), moyenne
    return meilleurs


def evaluer(nom, y, score, ca_annuel):
    precision, rappel, ordre = precision_rappel_haut(y, score)
    bas, haut = intervalle_auc(y, score)
    return {
        "modele": nom,
        "auc": round(roc_auc_score(y, score), 3),
        "auc_ic95": [round(bas, 3), round(haut, 3)],
        "precision_precision_10pct": round(float(precision), 3),
        "rappel_10pct": round(float(rappel), 3),
        "ca_detecte_10pct": round(float(ca_detecte(y, ca_annuel, ordre)), 3),
        "ap": round(average_precision_score(y, score), 3),
    }


def figures(arbre, resultats):
    FIGURES.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(16, 7))
    textes = plot_tree(
        arbre,
        feature_names=[NOMS[v] for v in VARIABLES],
        class_names=["stable", "départ"],
        filled=True,
        rounded=True,
        fontsize=9,
        ax=ax,
        impurity=False,
        proportion=True,
    )
    for texte in textes:
        contenu = texte.get_text()
        for ancien, nouveau in (("samples", "part des cas"), ("value", "répartition"), ("class", "classe"), ("<=", "≤"), ("True", "oui"), ("False", "non")):
            contenu = contenu.replace(ancien, nouveau)
        texte.set_text(contenu)
    ax.set_title("Arbre de décision : risque de départ à 3 mois", fontsize=13, fontweight="bold")
    fig.savefig(FIGURES / "modele_risque_arbre.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    fig, axes = plt.subplots(1, 3, figsize=(14, 4.2))
    couleurs = ["#6b7682", "#1f4e79", "#2c6a3a"]
    for ax, cle, titre in zip(
        axes,
        ["ap", "rappel_10pct", "ca_detecte_10pct"],
        ["Précision moyenne (AP)", "Départs détectés dans le top 10 %", "CA des départs détecté dans le top 10 %"],
    ):
        ax.bar([r["modele"] for r in resultats], [r[cle] for r in resultats], color=couleurs)
        ax.set_title(titre, fontsize=10)
        ax.set_ylim(0, 1)
        ax.tick_params(axis="x", labelsize=8)
        for i, r in enumerate(resultats):
            ax.text(i, r[cle] + 0.02, f"{r[cle]:.2f}", ha="center", fontsize=9)
    fig.suptitle("Arbre, règle simple et forêt aléatoire sur les derniers mois", fontsize=12, fontweight="bold")
    fig.savefig(FIGURES / "modele_risque_comparaison.png", dpi=150, bbox_inches="tight")
    plt.close(fig)


def entrainer(df: pd.DataFrame) -> dict:
    clients, periodes, ca, nb, groupe = grille(df)
    derniere = len(periodes) - 1
    fin_entrainement = derniere - ECART_FIN_ENTRAINEMENT
    debut_test = derniere - ECART_DEBUT_TEST
    jeu = construire(clients, ca, nb, groupe, derniere)
    entrainement = jeu[jeu["t"] <= fin_entrainement]
    test = jeu[(jeu["t"] >= debut_test) & (jeu["t"] <= derniere - HORIZON)]
    profondeur, feuille = choisir_hyperparametres(entrainement, fin_entrainement)
    arbre = DecisionTreeClassifier(
        max_depth=profondeur, min_samples_leaf=feuille, class_weight="balanced", random_state=0
    ).fit(entrainement[VARIABLES], entrainement["depart"])
    foret = RandomForestClassifier(
        n_estimators=300, max_depth=4, min_samples_leaf=feuille, class_weight="balanced_subsample", random_state=0
    ).fit(entrainement[VARIABLES], entrainement["depart"])
    y = test["depart"].to_numpy()
    ca_annuel = test["ca_annuel"].to_numpy()
    resultats = [
        evaluer("Règle simple", y, test["mois_depuis_derniere"].to_numpy(dtype=float), ca_annuel),
        evaluer("Arbre de décision", y, arbre.predict_proba(test[VARIABLES])[:, 1], ca_annuel),
        evaluer("Forêt aléatoire", y, foret.predict_proba(test[VARIABLES])[:, 1], ca_annuel),
    ]
    importances = sorted(zip(VARIABLES, arbre.feature_importances_), key=lambda x: -x[1])
    evaluation = {
        "periodes": {"premiere": int(periodes[0]), "derniere_complete": int(periodes[derniere - 1])},
        "entrainement": {
            "observations": int(len(entrainement)),
            "departs": int(entrainement["depart"].sum()),
            "clients": int(entrainement["tiers_id"].nunique()),
        },
        "test": {
            "observations": int(len(test)),
            "departs": int(test["depart"].sum()),
            "clients": int(test["tiers_id"].nunique()),
            "taux_de_base": round(float(test["depart"].mean()), 3),
        },
        "hyperparametres": {"profondeur": profondeur, "feuille_min": feuille},
        "resultats": resultats,
        "importances": [(NOMS[v], round(float(i), 3)) for v, i in importances if i > 0],
    }
    production = DecisionTreeClassifier(
        max_depth=profondeur, min_samples_leaf=feuille, class_weight="balanced", random_state=0
    ).fit(jeu[VARIABLES].to_numpy(), jeu["depart"])
    taux, base = taux_par_feuille(production, jeu[VARIABLES].to_numpy(), jeu["depart"])
    modele = {
        "arbre": production,
        "variables": VARIABLES,
        "taux_feuilles": taux,
        "taux_de_base": base,
        "seuils": {"eleve": SEUIL_ELEVE, "moyen": SEUIL_MOYEN},
        "dernier_mois_etiquete": int(periodes[derniere - 1]),
    }
    evaluation["production"] = {
        "observations": int(len(jeu)),
        "departs": int(jeu["depart"].sum()),
        "taux_de_base": round(base, 4),
        "seuils": {k: round(v, 4) for k, v in modele["seuils"].items()},
    }
    return {"modele": modele, "evaluation": evaluation, "jeu": jeu, "arbre_evaluation": arbre, "parametres": evaluation["hyperparametres"]}


def executer_pipeline(df: pd.DataFrame, dossier_registre=registre.REGISTRE, produire_figures: bool = False) -> dict:
    logger = journal("modele")
    with chronometre(logger, "entrainement", observations=int(len(df))):
        resultat = entrainer(df)
    evaluation = resultat["evaluation"]
    version = registre.enregistrer(resultat["modele"], evaluation, resultat["jeu"], VARIABLES, resultat["parametres"], dossier_registre)
    accepte, raisons = registre.evaluer_porte(evaluation, registre.meta_production(dossier_registre))
    registre.statuer(version, accepte, raisons, dossier_registre)
    evenement(
        logger,
        "modele_promu" if accepte else "modele_refuse",
        "info" if accepte else "warning",
        version=version,
        raisons=raisons,
        auc_arbre=registre.resultat(evaluation, "Arbre de décision")["auc"],
        auc_regle=registre.resultat(evaluation, "Règle simple")["auc"],
    )
    if produire_figures:
        figures(resultat["arbre_evaluation"], evaluation["resultats"])
    return {"version": version, "accepte": accepte, "raisons": raisons, "evaluation": evaluation}


def main():
    MODELES.mkdir(exist_ok=True)
    sortie = executer_pipeline(charger(), produire_figures=True)
    (MODELES / "evaluation.json").write_text(json.dumps(sortie["evaluation"], ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"version": sortie["version"], "accepte": sortie["accepte"], "raisons": sortie["raisons"]}, ensure_ascii=False))
    return 0 if sortie["accepte"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
