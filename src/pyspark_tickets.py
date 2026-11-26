import sys

from pyspark.sql import functions as F

import pyspark_commun as pc

SOURCE = "itop/tickets"
CONTRAT = "itop_tickets"
CORRESPONDANCE = pc.DATA / "correspondance_itop.csv"


def transformateur(spark):
    if CORRESPONDANCE.exists():
        table = spark.read.option("header", True).csv(str(CORRESPONDANCE))
        table = table.select(
            pc.normaliser(F.col("organisation_itop")).alias("cle_organisation"), F.col("code_sage")
        ).dropDuplicates(["cle_organisation"])
    else:
        table = None

    def transformer(valides):
        base = valides.select(
            F.col("Référence").alias("reference"),
            F.col("Type").alias("type"),
            F.col("Priorité").alias("priorite"),
            F.col("Etat").alias("etat"),
            pc.normaliser(F.col("`Demandeur->Nom organisation`")).alias("cle_organisation"),
            F.to_date(F.substring(F.col("Date de début"), 1, 10)).alias("date_debut"),
            F.to_date(F.substring(F.col("Date de résolution"), 1, 10)).alias("date_resolution"),
            F.col("Niveau d'impact").alias("impact"),
            (F.lower(F.col("SLA TTR dépassé ?")) == "oui").alias("sla_ttr_depasse"),
            F.col("Référence ticket Salesforce").cast("long").alias("reference_salesforce"),
        )
        if table is not None:
            base = base.join(table, "cle_organisation", "left")
        else:
            base = base.withColumn("code_sage", F.lit(None).cast("string"))
        base = base.drop("cle_organisation")
        if pc.PROFIL == "demo":
            base = base.withColumn(
                "code_sage",
                F.when(F.col("code_sage").isNotNull(), F.concat(F.lit("T"), F.substring(pc.empreinte(F.col("code_sage")), 1, 8))),
            )
        return base

    return transformer


def anonymiser(brut):
    reduit = pc.anonymiser_brut(
        brut,
        ligne=F.col("Référence"),
        dates=["Date de début", "Date de résolution", "date_photo"],
        jours=pc.decalage_jours("tickets"),
    )
    respecte = F.lower(F.col("SLA TTR dépassé ?")) != "oui"
    return reduit.filter(~respecte | (pc.tirage("sla", F.col("Référence")) >= 0.30))


def main() -> int:
    spark = pc.creer_session()
    return pc.executer_job(
        "pyspark_tickets",
        SOURCE,
        CONTRAT,
        transformateur(spark),
        "stg_tickets",
        [],
        "SELECT count(*) FROM staging.stg_tickets",
        lecteur=pc.lire_kafka(SOURCE),
        anonymiseur=anonymiser,
    )


if __name__ == "__main__":
    sys.exit(main())
