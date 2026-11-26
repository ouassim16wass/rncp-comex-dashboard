
import re
from pathlib import Path

import pandas as pd
import yaml

from lecture import lire

RACINE = Path(__file__).resolve().parent.parent
DATA = RACINE / "data"
DOCS = RACINE / "docs"

EXTRACTIONS = {
    "sage_ca_facture": {None: ("CA facturé oct26 bon1 (1).xlsx", {})},
    "sage_marge_brute": {None: ("marge brute sept26 bon 2.xlsx", {})},
    "sage_echeances": {
        "factures clients": ("factures clients bon oct26.xlsx", {}),
        "factures fournisseurs": ("factures fournisseurs oct26.xlsx", {}),
    },
    "salesforce_opportunites": {None: ("opportunites-20260409.xlsx", {"salesforce": True})},
    "itop_tickets": {None: ("Copie de excel Aurélie.xlsx", {})},
}


def violations(serie: pd.Series, col: dict) -> list[tuple[str, float, str]]:
    c = col.get("controles") or {}
    gravite = c.get("gravite", "avertissement")
    n = len(serie)
    res = []
    if c.get("non_nul"):
        res.append(("non nul", serie.isna().sum() / n, gravite))
    vals = serie.dropna()
    if "valeurs" in c:
        res.append(("valeurs autorisées", (~vals.astype(str).isin([str(v) for v in c["valeurs"]])).sum() / n, gravite))
    if "min" in c or "max" in c:
        num = pd.to_numeric(vals, errors="coerce")
        bad = (num < c.get("min", float("-inf"))) | (num > c.get("max", float("inf"))) | num.isna()
        res.append(("bornes", bad.sum() / n, gravite))
    if c.get("unique"):
        res.append(("unicité", serie.dropna().duplicated().sum() / n, gravite))
    return res


def main():
    out = [
        "# Vérification des contrats de données",
        "",
        "Rapport généré par `src/verifier_contrats.py`. Il ne contient que des taux, jamais de valeurs.",
        "",
    ]
    total_echecs = 0
    for fichier_contrat in sorted(DATA.glob("contrat_*.yaml")):
        contrat = yaml.safe_load(fichier_contrat.read_text(encoding="utf-8"))
        nom = contrat["contrat"]["nom"]
        seuil = contrat["qualite_globale"]["taux_rejet_max"]
        sources = EXTRACTIONS[nom]
        donnees = {}
        for cle, (fichier, opts) in sources.items():
            df = lire(fichier, salesforce=opts.get("salesforce", False))
            fin = contrat["entree"].get("lignes_de_fin_ignorees", 0)
            n_fin = fin.get(cle, 0) if isinstance(fin, dict) else fin
            if n_fin:
                df = df.iloc[:-n_fin]
            donnees[cle] = df
        out += [f"## {nom}", ""]
        lignes = [
            "| Colonne | Présente | Contrôle | Lignes en défaut | Gravité | Verdict |",
            "|---|---|---|---|---|---|",
        ]
        manquantes = 0
        for col in contrat["colonnes"]:
            df = donnees.get(col.get("fichier")) if col.get("fichier") else donnees[None]
            if col["source"] not in df.columns:
                lignes.append(f"| {col['source']} | non | | | | ÉCHEC : colonne absente |")
                manquantes += 1
                continue
            res = violations(df[col["source"]], col)
            if not res:
                lignes.append(f"| {col['source']} | oui | aucun | | | ok |")
            for ctl, taux, grav in res:
                if taux == 0:
                    verdict = "ok"
                elif grav == "erreur" and taux > seuil:
                    verdict = "ÉCHEC : dépasse le seuil de rejet"
                    total_echecs += 1
                else:
                    verdict = "à surveiller"
                lignes.append(f"| {col['source']} | oui | {ctl} | {taux * 100:.2f} % | {grav} | {verdict} |")
        total_echecs += manquantes
        out += lignes + [""]
        tailles = ", ".join(f"{len(d):,} lignes" for d in donnees.values())
        out += [f"Seuil de rejet du contrat : {seuil * 100:.0f} %. Extraction contrôlée : {tailles}.", ""]
    out += ["## Bilan", "", f"Échecs bloquants : {total_echecs}."]
    texte = re.sub(r"(?<=\d),(?=\d{3})", " ", "\n".join(out))
    (DOCS / "verification_contrats.md").write_text(texte, encoding="utf-8")
    print(texte.split("## Bilan")[1].strip())
    print("Rapport écrit :", DOCS / "verification_contrats.md")


if __name__ == "__main__":
    main()
