
import hashlib
import re

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from lecture import RACINE, SOURCES, lire

DOCS = RACINE / "docs"
FIGURES = DOCS / "figures"


def empreinte(nom: str) -> str:
    h = hashlib.md5()
    with open(SOURCES / nom, "rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


def profil(df: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "type": df.dtypes.astype(str),
            "rempli_%": (df.notna().mean() * 100).round(0).astype(int),
            "distinctes": df.nunique(),
        }
    )


def tableau_md(p: pd.DataFrame) -> list[str]:
    lignes = ["| Colonne | Type | Rempli | Valeurs distinctes |", "|---|---|---|---|"]
    for col, r in p.iterrows():
        lignes.append(f"| {col} | {r['type']} | {r['rempli_%']} % | {r['distinctes']} |")
    return lignes


def main():
    FIGURES.mkdir(parents=True, exist_ok=True)
    out = [
        "# Exploration des données sources",
        "",
        "Rapport généré par `src/exploration.py`. Il ne contient ni nom ni montant en euros : "
        "uniquement des volumes, des taux et des indices.",
        "",
    ]

    ca25 = lire("ca-facture-2025.xlsx")
    ca26a = lire("ca-facture-2026_260422.xlsx")
    ca_sept = lire("CA facturé sept26.xlsx")
    ca26b = lire("CA facturé oct26 bon1 (1).xlsx")
    doublon = empreinte("CA facturé sept26.xlsx") == empreinte("CA facturé sept26 (1).xlsx")
    sept_dans_oct = len(set(ca_sept["No facture"]) & set(ca26b["No facture"])) / ca_sept["No facture"].nunique() * 100
    nouvelles = len(set(ca26b["No facture"]) - set(ca_sept["No facture"]))

    ca26a_dans_b = set(ca26a["No facture"]) <= set(ca26b["No facture"])
    avant = ca26b["Date facture"] <= ca26a["Date facture"].max()
    meme_total = round(ca26a["Montant HT"].sum()) == round(ca26b.loc[avant, "Montant HT"].sum())

    ca = pd.concat([ca25[ca25["Date facture"] < ca26b["Date facture"].min()], ca26b], ignore_index=True)
    ca["mois_cal"] = ca["Date facture"].dt.to_period("M")
    nb_neg = (ca["Montant HT"] < 0).mean() * 100
    nego = (ca["Services"] == 990).mean() * 100

    out += [
        "## 1. Sage : CA facturé",
        "",
        f"- Fichiers : 2025 ({len(ca25):,} lignes), 2026 au 22/04 ({len(ca26a):,}), 2026 à mi-septembre ({len(ca26b):,}, la plus récente).",
        f"- Le fichier `sept26 (1)` est un doublon exact de `sept26` : {'oui' if doublon else 'non'}.",
        f"- Le fichier 2026 au 22/04 est contenu dans `sept26` (mêmes factures : {ca26a_dans_b}, même total : {meme_total}).",
        f"- Le fichier `oct26` reprend {sept_dans_oct:.0f} % des factures de `sept26` et ajoute {nouvelles:,} factures : chaque extraction remplace la précédente (règle « garder la dernière »).",
        f"- Jeu consolidé : {len(ca):,} lignes, du {ca['Date facture'].min():%d/%m/%Y} au {ca['Date facture'].max():%d/%m/%Y}.",
        f"- {ca['Raison sociale'].nunique()} clients distincts, {ca['No facture'].nunique():,} factures.",
        f"- Lignes d'avoir (montant négatif) : {nb_neg:.1f} %. Lignes de négoce (service 990, à exclure du CA) : {nego:.1f} %.",
        f"- Codes `Services` : {ca25['Services'].nunique()} codes en 2025 contre {ca26b['Services'].nunique()} en 2026 (référentiel qui a changé).",
        "",
    ]

    ca_m = pd.concat([ca25.assign(an=2025), ca26b.assign(an=2026)])
    ca_m = ca_m[ca_m["Date facture"] >= "2025-01-16"]
    bornes = ca_m.groupby(["an", "Mois"])["Date facture"].agg(["min", "max"]).reset_index()
    jours_debut = bornes["min"].dt.day.median()
    jours_fin = bornes["max"].dt.day.median()
    ecart = (ca_m["Date facture"].dt.month != ca_m["Mois"]).mean() * 100
    out += [
        "**Règle du mois (à confirmer avec la DAF)** : la colonne `Mois` ne suit pas le mois calendaire. "
        f"{ecart:.0f} % des lignes ont un `Mois` différent du mois de la date de facture. "
        f"Un `Mois` commence en médiane autour du {jours_debut:.0f} du mois civil et se termine autour du {jours_fin:.0f} du suivant (donc plutôt le 20 que le 15).",
        "",
    ]

    actifs = ca[ca["Services"] != 990].groupby("mois_cal")["Raison sociale"].nunique()
    creux = actifs[actifs < actifs.median() * 0.5]
    out += [
        "### Trous dans la donnée",
        "",
        f"- Clients facturés par mois : médiane {actifs.median():.0f}.",
        f"- Mois très inférieurs à la médiane (moins de 50 %) : {', '.join(f'{m} ({v})' for m, v in creux.items()) or 'aucun'}.",
        "- Le dernier mois est partiel (extraction au 17 septembre).",
        "",
    ]

    fig, ax = plt.subplots(figsize=(9, 3.6))
    actifs.index = actifs.index.astype(str)
    ax.bar(actifs.index, actifs.values, color="#1f4e79")
    ax.axhline(actifs.median(), color="#c0392b", ls="--", lw=1, label="médiane")
    ax.set_title("Clients facturés par mois (Sage)")
    ax.set_ylabel("Nombre de clients")
    ax.tick_params(axis="x", rotation=60, labelsize=8)
    ax.legend()
    fig.tight_layout()
    fig.savefig(FIGURES / "exploration_clients_par_mois.png", dpi=150)
    plt.close(fig)

    ca_mois = ca[ca["Services"] != 990].groupby("mois_cal")["Montant HT"].sum()
    indice = ca_mois / ca_mois.median() * 100
    indice.index = indice.index.astype(str)
    fig, ax = plt.subplots(figsize=(9, 3.6))
    ax.plot(indice.index, indice.values, marker="o", color="#1f4e79")
    ax.axhline(100, color="grey", ls=":", lw=1)
    ax.set_title("CA facturé par mois (indice, base 100 = mois médian)")
    ax.tick_params(axis="x", rotation=60, labelsize=8)
    fig.tight_layout()
    fig.savefig(FIGURES / "exploration_ca_indice.png", dpi=150)
    plt.close(fig)

    h = ca[ca["Services"] != 990].copy()
    h["m"] = h["mois_cal"].astype(str)
    avant_c = set(h[h["m"].between("2026-02", "2026-05")]["Raison sociale"])
    apres_c = set(h[h["m"].between("2026-07", "2026-09")]["Raison sociale"])
    partis = avant_c - apres_c
    ca_avant = h[h["m"].between("2026-02", "2026-05")]
    part_ca = ca_avant[ca_avant["Raison sociale"].isin(partis)]["Montant HT"].sum() / ca_avant["Montant HT"].sum() * 100
    gh = h[h["Raison sociale"].isin(partis)].drop_duplicates("Raison sociale")["G/HG"].value_counts().to_dict()
    dom = h.groupby(["Domaine", "m"])["Raison sociale"].nunique().unstack(0)
    dernier = (
        h[h["Raison sociale"].isin(partis)].groupby("Raison sociale")["m"].max().value_counts().sort_index().to_dict()
    )
    out += [
        "### Baisse du nombre de clients facturés depuis juin 2026",
        "",
        f"- {len(avant_c)} clients facturés de février à mai, {len(partis)} ne le sont plus de juillet à septembre.",
        f"- Ces {len(partis)} clients portaient {part_ca:.1f} % du CA de février à mai (donc un effet limité sur le CA total).",
        f"- Segment des clients absents : {gh}.",
        f"- Dernier mois facturé des clients absents : {dernier}.",
        "- Clients facturés par mois et par domaine (derniers mois) :",
        "",
    ]
    out += ["| Mois | " + " | ".join(str(c) for c in dom.columns) + " |", "|---|" + "---|" * len(dom.columns)]
    for m_, r in dom.tail(8).iterrows():
        out.append(f"| {m_} | " + " | ".join("" if pd.isna(v) else str(int(v)) for v in r) + " |")
    out += [
        "",
        "Cause à confirmer avec la DAF : départ réel, changement de circuit de facturation ou extraction incomplète.",
        "",
    ]

    nb_mois = ca[ca["Services"] != 990].groupby("Raison sociale")["mois_cal"].nunique()
    out += [
        "### Régularité des clients",
        "",
        f"- Mois facturés par client (sur {ca['mois_cal'].nunique()}) : "
        f"10 % des clients en ont {nb_mois.quantile(0.1):.0f} ou moins, la médiane est {nb_mois.median():.0f}, 75 % en ont {nb_mois.quantile(0.75):.0f} ou plus.",
        f"- Clients facturés au moins 6 mois (candidats « clients récurrents ») : {(nb_mois >= 6).sum()} sur {len(nb_mois)}.",
        "",
    ]
    out += ["### Colonnes de la table CA (jeu 2026)", ""] + tableau_md(profil(ca26b)) + [""]

    marge = lire("marge brute sept26 bon 2.xlsx")
    out += [
        "## 2. Sage : marge brute (écritures comptables)",
        "",
        f"- {len(marge):,} écritures du {marge['Date comptable'].min():%d/%m/%Y} au {marge['Date comptable'].max():%d/%m/%Y}.",
        "- Les lignes vides de l'export Excel sont ignorées au chargement.",
        f"- Pièces distinctes : {marge['Numéro de pièce'].nunique():,}. Comptes distincts : {marge['Comptes généraux'].nunique()}.",
        f"- Le tiers n'est renseigné que sur {marge['Tiers Client / Fournisseur'].notna().mean() * 100:.0f} % des lignes : la marge par client est limitée.",
        "",
    ]
    marge["classe"] = (marge["Comptes généraux"] // 10000).astype(int)
    produits = marge[marge["classe"] == 70]
    charges = marge[marge["classe"] < 70]
    par_classe = marge.groupby("classe").agg(
        lignes=("classe", "size"),
        domaine=("Domaine", lambda x: round(x.notna().mean() * 100)),
        tiers=("Tiers Client / Fournisseur", lambda x: round(x.notna().mean() * 100)),
    )
    out += [
        f"- Produits (comptes 70) : {len(produits):,} lignes. Charges (comptes 60 à 69) : {len(charges):,} lignes.",
        "- La marge est donc calculée sur des écritures comptables : une même table contient les produits et les charges.",
        f"- Écritures par mois : {marge.groupby(marge['Date comptable'].dt.to_period('M')).size().to_dict()}.",
        "",
        "### Rattachement des écritures (taux de remplissage par classe de compte)",
        "",
        "| Classe de compte | Lignes | Domaine renseigné | Tiers renseigné |",
        "|---|---|---|---|",
    ]
    out += [f"| {k} | {r['lignes']:,} | {r['domaine']} % | {r['tiers']} % |" for k, r in par_classe.iterrows()]
    out += [
        "",
        "Les charges sont rarement rattachées à un client et à moitié à un domaine : la marge se calcule par domaine et par mois, "
        "pas par client, et une part des charges reste « non affectée ».",
        "",
    ]
    out += tableau_md(profil(marge.drop(columns="classe"))) + [""]

    fc1 = lire("factures-client-20260316.xlsx")
    fc2 = lire("factures-client-20260409.xlsx")
    ff = lire("factures-fournisseurs-20260316.xlsx")
    fc3 = lire("factures clients bon oct26.xlsx")
    ff2 = lire("factures fournisseurs oct26.xlsx")
    pieces1, pieces2 = set(fc1["Type / Numéro de pièce"]), set(fc2["Type / Numéro de pièce"])
    soldees = len(pieces1 - pieces2)
    out += (
        [
            "## 3. Sage : factures clients et fournisseurs (photos de l'impayé)",
            "",
            f"- Factures clients : photo du 16/03 ({len(fc1):,} lignes) et du 09/04 ({len(fc2):,}).",
            f"- Pièces présentes au 16/03 et absentes au 09/04 (payées ou lettrées entre les deux) : {soldees:,} sur {len(pieces1):,}.",
            "- Les colonnes d'ancienneté (échu > 30 jours, > 60 jours, > 2 ans) sont vides : elles étaient calculées à la main dans Excel. L'entrepôt devra les recalculer.",
            f"- Photo d'octobre : factures clients {len(fc3):,} lignes et seulement {fc3.shape[1]} colonnes ({', '.join(fc3.columns)}), sans numéro de pièce.",
            f"- Factures fournisseurs : {len(ff):,} lignes au 16/03 (une par pièce), {len(ff2):,} lignes en octobre (une par pièce, {ff2['Tiers'].nunique()} tiers).",
            "- Le format des extractions change d'une date à l'autre : le grain commun est un solde par tiers et par échéance.",
            "- Il n'y a pas de date de règlement : on peut dire qu'une facture a disparu entre deux photos, pas quand elle a été payée.",
            "",
            "### Colonnes factures clients (09/04)",
            "",
        ]
        + tableau_md(profil(fc2))
        + [""]
    )

    opp = lire("opportunites-20260409.xlsx", salesforce=True)
    rdv = lire("rdv-20260409.xlsx", salesforce=True)
    out += [
        "## 4. Salesforce : opportunités et rendez-vous",
        "",
        "- Les exports ont des lignes de titre avant l'en-tête et des colonnes sans nom : le nettoyage doit les détecter.",
        f"- Opportunités : {len(opp):,} lignes. Rendez-vous : {len(rdv):,} lignes.",
        "",
        "### Opportunités : étapes et motifs de clôture",
        "",
    ]
    etape = opp["Étape"].value_counts(dropna=False)
    motif = opp["Motif de clôture"].value_counts(dropna=False)
    out += ["| Étape | Nombre |", "|---|---|"] + [f"| {k} | {v} |" for k, v in etape.items()] + [""]
    out += ["| Motif de clôture | Nombre |", "|---|---|"] + [f"| {k} | {v} |" for k, v in motif.items()] + [""]
    gagnees = motif[motif.index.astype(str).str.startswith("Gagnée")].sum()
    perdue = motif.get("Perdue", 0)
    abandon = motif.get("Abandonnée", 0) + motif[motif.index.astype(str).str.startswith("No Go")].sum()
    out += [
        f"**Win ratio : deux définitions.** Gagnées / (gagnées + perdues) = {gagnees / (gagnees + perdue) * 100:.0f} %. "
        f"En comptant aussi les abandonnées et les « No Go » comme échecs : {gagnees / (gagnees + perdue + abandon) * 100:.0f} %. "
        "La définition est à valider avec les commerciaux.",
        "",
    ]
    out += ["### Colonnes opportunités", ""] + tableau_md(profil(opp)) + [""]

    it = lire("Copie de excel Aurélie.xlsx")
    sla = (it["SLA TTR dépassé ?"] == "oui").mean() * 100
    lie = it["Référence ticket Salesforce"].notna().mean() * 100
    out += (
        [
            "## 5. iTop : tickets",
            "",
            f"- {len(it):,} tickets créés du {it['Date de début'].min():%d/%m/%Y} au {it['Date de début'].max():%d/%m/%Y}.",
            f"- Répartition : {it['Type'].value_counts().to_dict()}.",
            f"- SLA de résolution dépassé : {sla:.1f} % des tickets.",
            f"- Tickets liés à un ticket Salesforce : {lie:.1f} % (le calcul des incidents devra supprimer ces doublons).",
            "- Les échéances (TTO, TTR) sont stockées en secondes depuis 1970 : à convertir.",
            "",
        ]
        + tableau_md(profil(it))
        + [""]
    )

    sources = {
        "CA": ca26b,
        "Marge": marge.drop(columns="classe"),
        "Factures clients": fc2,
        "Factures fourn.": ff,
        "Factures clients (oct.)": fc3,
        "Opportunités": opp,
        "RDV": rdv,
        "Tickets iTop": it,
    }
    vides = {k: int((v.notna().mean() < 0.05).sum()) for k, v in sources.items()}
    fig, ax = plt.subplots(figsize=(8, 3.6))
    ax.barh(list(vides), list(vides.values()), color="#c0392b")
    ax.set_title("Colonnes presque vides (moins de 5 % remplies), par source")
    fig.tight_layout()
    fig.savefig(FIGURES / "exploration_colonnes_vides.png", dpi=150)
    plt.close(fig)
    out += ["## 6. Synthèse", "", "| Source | Colonnes | Presque vides (moins de 5 %) |", "|---|---|---|"]
    out += [f"| {k} | {v.shape[1]} | {vides[k]} |" for k, v in sources.items()] + [""]

    texte = re.sub(r"(?<=\d),(?=\d{3})", " ", "\n".join(out))
    (DOCS / "exploration_donnees.md").write_text(texte, encoding="utf-8")
    print("Rapport écrit :", DOCS / "exploration_donnees.md")


if __name__ == "__main__":
    main()
