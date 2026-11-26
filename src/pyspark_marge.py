import sys

from pyspark.sql import functions as F

import pyspark_commun as pc

SOURCE = "sage/marge"
CONTRAT = "sage_marge"


def transformer(valides):
    base = valides.select(
        F.to_date(F.substring(F.col("Date comptable"), 1, 10)).alias("date_comptable"),
        F.col("Type de pièce").alias("type_piece"),
        F.col("Numéro de pièce").alias("numero_piece"),
        F.col("Comptes généraux").cast("long").alias("compte_general"),
        F.col("LIB 1").alias("lib_1"),
        F.col("LIB 2").alias("lib_2"),
        F.col("Section analytique").cast("long").alias("section_analytique"),
        F.col("Domaine").alias("domaine"),
        F.col("Build/Run").alias("build_run"),
        F.col("Montant").cast("double").alias("montant_signe"),
        F.col("Tiers Client / Fournisseur").alias("code_sage"),
    )
    if pc.PROFIL != "demo":
        return base
    return base.withColumn(
        "code_sage",
        F.when(F.col("code_sage").isNotNull(), F.concat(F.lit("T"), F.substring(pc.empreinte(F.col("code_sage")), 1, 8))),
    ).withColumn("montant_signe", F.round(F.col("montant_signe") * pc.COEFFICIENT, 2))


def anonymiser(brut):
    return pc.anonymiser_brut(
        brut,
        client=F.col("`Tiers Client / Fournisseur`"),
        ligne=F.concat_ws("|", F.col("`Numéro de pièce`"), F.col("`Comptes généraux`"), F.col("Montant")),
        montants=["Montant"],
        dates=["Date comptable"],
        annee=F.col("`Date comptable`"),
        categories=[F.col("`Build/Run`")],
    )


def main() -> int:
    return pc.executer_job(
        "pyspark_marge",
        SOURCE,
        CONTRAT,
        transformer,
        "stg_marge",
        ["02_referentiels.sql", "04_charger_marge.sql"],
        "SELECT count(*) FROM dwh.fait_marge",
        controle={
            "brute": "Montant",
            "staging": "montant_signe",
            "entrepot": "SELECT sum(montant_signe) FROM dwh.fait_marge",
            "libelle": "Montant signé des écritures",
        },
        anonymiseur=anonymiser,
    )


if __name__ == "__main__":
    sys.exit(main())
