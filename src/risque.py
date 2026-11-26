import numpy as np
import pandas as pd

HORIZON = 3
FENETRE = 6
ACTIFS_MIN = 4
PREMIER_T = 6
NOMS = {
    "ca_1m": "CA du mois",
    "ca_3m": "CA des 3 derniers mois",
    "ratio_3m": "CA 3 derniers mois / 3 mois précédents",
    "actifs_6m": "Mois facturés sur 6",
    "actifs_3m": "Mois facturés sur 3",
    "mois_depuis_derniere": "Mois depuis la dernière facture",
    "nb_factures_3m": "Factures sur 3 mois",
    "ca_moyen_6m": "CA moyen mensuel sur 6 mois",
    "tendance": "CA du mois / moyenne 6 mois",
    "groupe": "Client du groupe",
}
VARIABLES = list(NOMS)


def grille(df: pd.DataFrame):
    periodes = sorted(df["periode"].unique())
    clients = sorted(df["tiers_id"].unique())
    ligne = {c: i for i, c in enumerate(clients)}
    colonne = {p: j for j, p in enumerate(periodes)}
    ca = np.zeros((len(clients), len(periodes)))
    nb = np.zeros_like(ca)
    for r in df.itertuples():
        ca[ligne[r.tiers_id], colonne[r.periode]] += r.ca_ht
        nb[ligne[r.tiers_id], colonne[r.periode]] += r.nb_factures
    groupe = df.groupby("tiers_id")["segment"].agg(lambda s: s.mode().iat[0] == "Groupe")
    return clients, periodes, ca, nb, np.array([groupe[c] for c in clients], dtype=float)


def variables_client(ca, nb, groupe, actif, k, i):
    fenetre = actif[k, i - FENETRE + 1 : i + 1]
    if fenetre.sum() < ACTIFS_MIN:
        return None
    ca3 = ca[k, i - 2 : i + 1].sum()
    prec3 = ca[k, i - 5 : i - 2].sum()
    passes = np.where(actif[k, : i + 1])[0]
    return {
        "ca_1m": ca[k, i],
        "ca_3m": ca3,
        "ratio_3m": min(max(ca3 / prec3, 0), 5) if prec3 > 0 else 5.0,
        "actifs_6m": int(fenetre.sum()),
        "actifs_3m": int(actif[k, i - 2 : i + 1].sum()),
        "mois_depuis_derniere": i - passes[-1],
        "nb_factures_3m": nb[k, i - 2 : i + 1].sum(),
        "ca_moyen_6m": ca[k, i - 5 : i + 1].mean(),
        "tendance": ca[k, i] / (ca[k, i - 5 : i + 1].mean() + 1),
        "groupe": groupe[k],
        "ca_annuel": ca[k, i - 5 : i + 1].sum() * 2,
    }


def construire(clients, ca, nb, groupe, dernier_t) -> pd.DataFrame:
    actif = ca > 0
    lignes = []
    for t in range(PREMIER_T, dernier_t - HORIZON + 1):
        i = t - 1
        for k, client in enumerate(clients):
            obs = variables_client(ca, nb, groupe, actif, k, i)
            if obs is None:
                continue
            obs.update(tiers_id=client, t=t, depart=int(not actif[k, i + 1 : i + 1 + HORIZON].any()))
            lignes.append(obs)
    return pd.DataFrame(lignes)


def observations_courantes(clients, ca, nb, groupe, t) -> pd.DataFrame:
    actif = ca > 0
    lignes = []
    for k, client in enumerate(clients):
        obs = variables_client(ca, nb, groupe, actif, k, t - 1)
        if obs is not None:
            obs.update(tiers_id=client, t=t)
            lignes.append(obs)
    return pd.DataFrame(lignes)


def taux_par_feuille(arbre, X, y, poids=10):
    base = float(np.mean(y))
    feuilles = pd.DataFrame({"feuille": arbre.apply(X), "depart": np.asarray(y)})
    resume = feuilles.groupby("feuille")["depart"].agg(["sum", "count"])
    taux = ((resume["sum"] + poids * base) / (resume["count"] + poids)).to_dict()
    return {int(f): float(v) for f, v in taux.items()}, base


def scorer(modele: dict, observations: pd.DataFrame) -> pd.DataFrame:
    if observations.empty:
        return observations.assign(probabilite=[], niveau=[])
    arbre = modele["arbre"]
    feuilles = arbre.apply(observations[VARIABLES].to_numpy())
    probabilite = np.array([modele["taux_feuilles"][int(f)] for f in feuilles])
    niveau = np.where(
        probabilite >= modele["seuils"]["eleve"], "élevé", np.where(probabilite >= modele["seuils"]["moyen"], "moyen", "faible")
    )
    return observations.assign(probabilite=probabilite, niveau=niveau)


def explication(arbre, valeurs: np.ndarray) -> list[dict]:
    arbre_interne = arbre.tree_
    chemin = arbre.decision_path(valeurs.reshape(1, -1)).indices
    regles = []
    for noeud in chemin:
        if arbre_interne.children_left[noeud] == arbre_interne.children_right[noeud]:
            continue
        indice = arbre_interne.feature[noeud]
        seuil = float(arbre_interne.threshold[noeud])
        valeur = float(valeurs[indice])
        regles.append(
            {
                "variable": NOMS[VARIABLES[indice]],
                "valeur": round(valeur, 2),
                "condition": f"≤ {seuil:.2f}" if valeur <= seuil else f"> {seuil:.2f}",
            }
        )
    return regles
