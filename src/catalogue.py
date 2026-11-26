
from collections import defaultdict
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
DATA = RACINE / "data"
DOCS = RACINE / "docs"

ORDRE = [
    "fait_facturation",
    "fait_marge",
    "fait_echeance",
    "fait_opportunite",
    "dim_date",
    "dim_mois",
    "dim_trimestre",
    "dim_mois_facturation",
    "dim_tiers",
    "dim_type_tiers",
    "dim_segment",
    "dim_service",
    "dim_domaine",
    "dim_commercial",
    "dim_produit",
    "dim_famille_produit",
    "dim_compte",
    "dim_classe_compte",
    "dim_statut_opportunite",
    "dim_etape",
    "dim_motif_cloture",
    "stg_tickets",
]
NIVEAU = {"public": 0, "interne": 1, "confidentiel": 2, "personnel": 3}

CLES = {
    "fait_facturation": [
        ("ligne_facture_id", "Identifiant technique de la ligne de facture (clé primaire)."),
        ("date_facture_id", "Clé vers dim_date (date de la facture)."),
        ("mois_facturation_id", "Clé vers dim_mois_facturation."),
        ("tiers_id", "Clé vers dim_tiers (le client)."),
        ("produit_id", "Clé vers dim_produit (l'article)."),
        ("service_id", "Clé vers dim_service (le code de service)."),
        ("commercial_id", "Clé vers dim_commercial."),
        ("compte_id", "Clé vers dim_compte."),
    ],
    "fait_marge": [
        ("ecriture_id", "Identifiant technique de l'écriture comptable (clé primaire)."),
        ("date_comptable_id", "Clé vers dim_date (date de l'écriture)."),
        ("compte_id", "Clé vers dim_compte."),
        ("domaine_id", "Clé vers dim_domaine ; « non affecté » quand le domaine est vide."),
        ("tiers_id", "Clé vers dim_tiers ; renseignée sur un tiers des écritures seulement."),
    ],
    "fait_echeance": [
        ("echeance_id", "Identifiant technique de la pièce ouverte (clé primaire)."),
        ("date_photo_id", "Clé vers dim_date (date de la photo)."),
        ("date_echeance_id", "Clé vers dim_date (date d'échéance)."),
        ("tiers_id", "Clé vers dim_tiers (client ou fournisseur)."),
    ],
    "fait_opportunite": [
        ("opportunite_photo_id", "Identifiant technique de l'opportunité à une date de photo (clé primaire)."),
        ("date_photo_id", "Clé vers dim_date (date de la photo)."),
        ("tiers_id", "Clé vers dim_tiers (le compte)."),
        ("commercial_id", "Clé vers dim_commercial."),
        ("domaine_id", "Clé vers dim_domaine."),
        ("statut_id", "Clé vers dim_statut_opportunite."),
    ],
}


def plus_sensible(a: str, b: str) -> str:
    return a if NIVEAU[a] >= NIVEAU[b] else b


def charger():
    contrats = [yaml.safe_load(f.read_text(encoding="utf-8")) for f in sorted(DATA.glob("contrat_*.yaml"))]
    ref = yaml.safe_load((DATA / "referentiels.yaml").read_text(encoding="utf-8"))["referentiels"]
    return contrats, ref


def main():
    contrats, ref = charger()
    colonnes = defaultdict(lambda: {"def": "", "type": "", "origines": [], "regles": [], "sens": "interne"})
    systeme = {}
    for c in contrats:
        meta = c["contrat"]
        systeme[meta["nom"]] = meta["source"].split(" (")[0]
        for col in c["colonnes"]:
            cible = col["entrepot"]
            if cible.startswith("controle."):
                continue
            e = colonnes[cible]
            e["def"] = e["def"] or col["description"]
            e["type"] = e["type"] or col["type"]
            fichier = f" ({col['fichier']})" if col.get("fichier") else ""
            e["origines"].append(f"{systeme[meta['nom']]}, contrat {meta['nom']}{fichier}, colonne « {col['source']} »")
            if col["regle"] not in e["regles"]:
                e["regles"].append(col["regle"])
            e["sens"] = plus_sensible(e["sens"], col["sensibilite"])
        for col in c.get("colonnes_derivees", []):
            e = colonnes[col["entrepot"]]
            e["def"], e["type"] = col["description"], col["type"]
            e["origines"].append(f"Calculée ({meta['nom']})")
            e["regles"].append(col["regle"])
            e["sens"] = plus_sensible(e["sens"], col["sensibilite"])
    for r in ref:
        for col in r["colonnes"]:
            e = colonnes[f"{r['table']}.{col['nom']}"]
            e["def"] = e["def"] or col["description"]
            e["type"] = e["type"] or col["type"]
            if r["origine"] not in e["origines"]:
                e["origines"].append(r["origine"])
            e["sens"] = plus_sensible(e["sens"], col["sensibilite"])
    for table, cles in CLES.items():
        for nom, desc in cles:
            e = colonnes[f"{table}.{nom}"]
            e["def"], e["type"] = desc, "entier"
            e["origines"].append("Clé technique générée par l'entrepôt")
            e["sens"] = plus_sensible(e["sens"], "interne")

    par_table = defaultdict(list)
    for cible, e in colonnes.items():
        t, n = cible.split(".", 1)
        par_table[t].append((n, e))

    out = [
        "# Catalogue de données de l'entrepôt",
        "",
        "Généré par `src/catalogue.py` depuis les contrats de données (`data/`). "
        "Il explique chaque colonne de l'entrepôt : son sens, son origine et la règle qui la produit. "
        "Il ne contient aucune donnée réelle.",
        "",
        "Sensibilité : **interne** (usage de l'entreprise), **confidentiel** (secret des affaires : pseudonymisé ou transformé hors de l'entreprise), "
        "**personnel** (identifie une personne : pseudonymisé).",
        "",
        "## Les sources",
        "",
        "| Contrat | Source | Propriétaire | Grain | Fréquence | Finalité |",
        "|---|---|---|---|---|---|",
    ]
    for c in contrats:
        m = c["contrat"]
        out.append(
            f"| {m['nom']} | {m['source']} | {m['proprietaire']} | {m['grain']} | {m['frequence']} | {m['finalite']} |"
        )
    out += ["", "Conservation et base légale : à valider avec le DPO (voir chaque contrat).", ""]

    for table in [t for t in ORDRE if t in par_table]:
        grain = next((c["contrat"]["grain"] for c in contrats if c["contrat"]["table_cible"] == table), None)
        out += [f"## {table}", ""]
        if grain:
            out += [f"Grain : {grain}.", ""]
        out += [
            "| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |",
            "|---|---|---|---|---|---|",
        ]
        cles = [n for n, _ in CLES.get(table, [])]
        for n, e in sorted(par_table[table], key=lambda x: (x[0] not in cles, cles.index(x[0]) if x[0] in cles else 0)):
            regle = "<br>".join(e["regles"]) if e["regles"] else "Aucune"
            out.append(f"| `{n}` | {e['type']} | {e['def']} | {'<br>'.join(e['origines'])} | {regle} | {e['sens']} |")
        out.append("")

    sens = defaultdict(list)
    for cible, e in colonnes.items():
        sens[e["sens"]].append(cible)
    out += ["## Sensibilité des colonnes", "", "| Niveau | Colonnes |", "|---|---|"]
    for niv in ("personnel", "confidentiel", "interne"):
        out.append(f"| {niv} | {len(sens[niv])} |")
    out += ["", "Colonnes personnelles (à pseudonymiser) :", ""]
    out += [f"- `{c}`" for c in sorted(sens["personnel"])]
    out.append("")
    (DOCS / "catalogue_donnees.md").write_text("\n".join(out), encoding="utf-8")
    print(f"Catalogue écrit : {len(colonnes)} colonnes, {len(par_table)} tables")


if __name__ == "__main__":
    main()
