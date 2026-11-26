import sys

from pyspark.sql import functions as F

import pyspark_commun as pc

SOURCE = "sage/ca"
CONTRAT = "sage_ca"


def transformer(valides):
    d = F.to_date(F.substring(F.col("Date facture"), 1, 10))
    mois_sage = F.col("Mois").cast("int")
    annee_mois_sage = (
        F.year(d)
        + F.when((mois_sage == 1) & (F.month(d) == 12), 1).when((mois_sage == 12) & (F.month(d) == 1), -1).otherwise(0)
    ).cast("int")
    base = valides.select(
        d.alias("date_facture"),
        F.col("No facture").alias("no_facture"),
        F.col("Type facture").alias("type_facture"),
        F.col("Tiers").alias("code_sage"),
        F.col("Raison sociale").alias("raison_sociale_pseudo"),
        F.when(F.col("G/HG") == "G", "Groupe").otherwise("Hors groupe").alias("segment"),
        F.col("Article").alias("article"),
        F.col("Famille statistique").alias("famille_statistique"),
        mois_sage.alias("mois_sage"),
        annee_mois_sage.alias("annee_mois_sage"),
        F.col("Qté facturée").cast("double").alias("quantite"),
        F.col("Montant HT").cast("double").alias("montant_ht"),
        F.col("Services").cast("long").alias("code_service"),
        F.col("Domaine").alias("domaine"),
        F.col("Build/Run").alias("build_run"),
        F.col("Code Commercial").cast("long").alias("code_commercial"),
        F.col("Comptes généraux").cast("long").alias("compte_general"),
    )
    if pc.PROFIL != "demo":
        return base
    return (
        base.withColumn("raison_sociale_pseudo", F.concat(F.lit("Client "), F.substring(pc.empreinte(F.col("code_sage")), 1, 6)))
        .withColumn("code_sage", F.concat(F.lit("T"), F.substring(pc.empreinte(F.col("code_sage")), 1, 8)))
        .withColumn("code_commercial", F.when(F.col("code_commercial").isNotNull(), pc.entier_pseudonyme(F.col("code_commercial"), 900000, 100000)))
        .withColumn("montant_ht", F.round(F.col("montant_ht") * pc.COEFFICIENT, 2))
    )


def anonymiser(brut):
    return pc.anonymiser_brut(
        brut,
        client=F.col("Tiers"),
        ligne=F.col("No facture"),
        montants=["Montant HT"],
        dates=["Date facture"],
        annee=F.col("Date facture"),
        categories=[F.col("`G/HG`"), F.col("`Build/Run`")],
    )


def main() -> int:
    return pc.executer_job(
        "pyspark_ca", SOURCE, CONTRAT, transformer, "stg_ca", ["02_referentiels.sql", "03_charger_facturation.sql"], "SELECT count(*) FROM dwh.fait_facturation",
        controle={
            "brute": "Montant HT",
            "staging": "montant_ht",
            "entrepot": "SELECT sum(montant_ht) FROM dwh.fait_facturation",
            "libelle": "Montant HT facturé",
        },
        anonymiseur=anonymiser,
    )


if __name__ == "__main__":
    sys.exit(main())
