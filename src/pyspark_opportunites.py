import sys

from pyspark.sql import functions as F

import pyspark_commun as pc

SOURCE = "salesforce/opportunites"
CONTRAT = "salesforce_opportunites"
NON_RAPPROCHE = "NON_RAPPROCHE"


def referentiel_sage(spark):
    fichier, _ = pc.dernier_fichier("sage/ca")
    ca = spark.read.json(str(fichier))
    comptes = (
        ca.select(F.col("Tiers").alias("code_sage"), F.col("Raison sociale").alias("nom_sage"))
        .distinct()
        .withColumn("cle", pc.normaliser(F.col("nom_sage")))
    )
    uniques = comptes.groupBy("cle").agg(F.count("*").alias("nb"), F.min("code_sage").alias("code_sage"))
    comptes_sage = uniques.filter(F.col("nb") == 1).select("cle", "code_sage")
    commerciaux = (
        ca.filter(F.col("Code Commercial").isNotNull())
        .select(
            F.col("Code Commercial").cast("long").alias("code_commercial"),
            pc.cle_personne(F.col("Nom Commercial")).alias("cle_commercial"),
        )
        .distinct()
        .groupBy("cle_commercial")
        .agg(F.min("code_commercial").alias("code_commercial"))
    )
    return comptes_sage, commerciaux


def transformateur(spark):
    comptes_sage, commerciaux = referentiel_sage(spark)

    def transformer(valides):
        base = valides.select(
            F.to_date(F.substring(F.col("date_photo"), 1, 10)).alias("date_photo"),
            F.col("Nom du compte").alias("nom_compte"),
            F.col("Propriétaire de l'opportunité").alias("proprietaire"),
            F.col("Montant global").cast("double").alias("montant_global"),
            F.concat(F.lit("D"), F.substring(F.col("Domaine"), 1, 1)).alias("domaine"),
            F.col("Nombre de mois").cast("int").alias("nb_mois"),
            F.col("Étape").alias("etape"),
            F.col("Motif de clôture").alias("motif_cloture"),
            F.col("Type d'affaire").alias("type_affaire"),
        )
        base = base.withColumn("domaine", F.when(F.col("domaine").isin("D1", "D2", "D3", "D4"), F.col("domaine")))
        base = base.withColumn("est_gagnee", F.coalesce(F.col("motif_cloture").startswith("Gagnée"), F.lit(False)))
        base = base.withColumn("cle", pc.normaliser(F.col("nom_compte")))
        base = base.join(comptes_sage, "cle", "left")
        base = base.withColumn(
            "methode",
            F.when(F.col("code_sage").isNull(), F.lit("non_rapproche"))
            .when(F.upper(F.trim(F.col("nom_compte"))) == F.col("cle"), F.lit("nom_exact"))
            .otherwise(F.lit("nom_normalise")),
        )
        base = base.withColumn(
            "confiance",
            F.when(F.col("methode") == "nom_exact", 1.0).when(F.col("methode") == "nom_normalise", 0.9).otherwise(0.0),
        )
        base = base.withColumn("cle_commercial", pc.cle_personne(F.col("proprietaire")))
        base = base.join(commerciaux, "cle_commercial", "left")
        base = base.withColumn("cle_salesforce", F.when(F.col("code_sage").isNotNull(), F.col("cle")))
        base = base.withColumn("code_sage", F.coalesce(F.col("code_sage"), F.lit(NON_RAPPROCHE)))
        base = base.select(
            "date_photo",
            "code_sage",
            "cle_salesforce",
            "methode",
            "confiance",
            "code_commercial",
            "domaine",
            "montant_global",
            "nb_mois",
            "etape",
            "motif_cloture",
            "type_affaire",
            "est_gagnee",
        )
        if pc.PROFIL != "demo":
            return base
        return (
            base.withColumn(
                "code_sage",
                F.when(F.col("code_sage") == NON_RAPPROCHE, F.col("code_sage")).otherwise(
                    F.concat(F.lit("T"), F.substring(pc.empreinte(F.col("code_sage")), 1, 8))
                ),
            )
            .withColumn(
                "cle_salesforce",
                F.when(F.col("cle_salesforce").isNotNull(), F.concat(F.lit("S"), F.substring(pc.empreinte(F.col("cle_salesforce")), 1, 8))),
            )
            .withColumn(
                "code_commercial",
                F.when(F.col("code_commercial").isNotNull(), pc.entier_pseudonyme(F.col("code_commercial"), 900000, 100000)),
            )
            .withColumn("montant_global", F.round(F.col("montant_global") * pc.COEFFICIENT, 2))
        )

    return transformer


def anonymiseur(spark):
    comptes_sage, _ = referentiel_sage(spark)

    def anonymiser(brut):
        cle = pc.normaliser(F.col("Nom du compte"))
        avec_cle = brut.withColumn("_cle", cle).join(comptes_sage.withColumnRenamed("cle", "_cle").withColumnRenamed("code_sage", "_code"), "_cle", "left")
        resultat = pc.anonymiser_brut(
            avec_cle,
            client=F.coalesce(F.col("_code"), F.col("_cle")),
            ligne=F.concat_ws("|", F.col("Nom du compte"), F.col("`Propriétaire de l'opportunité`"), F.col("Montant global")),
            montants=["Montant global"],
            dates=["date_photo"],
            annee=F.col("date_photo"),
            jours=pc.decalage_jours("opportunites"),
        )
        abandon = F.col("Motif de clôture").startswith("Abandon")
        gagne = F.col("Motif de clôture").startswith("Gagn")
        resultat = resultat.filter(~abandon | (pc.tirage("abandon", F.col("Nom du compte"), F.col("Montant global")) >= 0.35))
        resultat = resultat.filter(~gagne | (pc.tirage("gain", F.col("Nom du compte"), F.col("Montant global")) >= 0.10))
        return resultat.drop("_cle", "_code")

    return anonymiser


def main() -> int:
    spark = pc.creer_session()
    comptage = (
        "SELECT count(*) FROM dwh.fait_opportunite f JOIN dwh.dim_date d ON d.date_id = f.date_photo_id "
        "WHERE d.date IN (SELECT DISTINCT date_photo FROM staging.stg_opportunites)"
    )
    return pc.executer_job(
        "pyspark_opportunites",
        SOURCE,
        CONTRAT,
        transformateur(spark),
        "stg_opportunites",
        ["02_referentiels.sql", "06_charger_opportunites.sql"],
        comptage,
        lecteur=pc.lire_kafka(SOURCE),
        controle={
            "brute": "Montant global",
            "staging": "montant_global",
            "entrepot": (
                "SELECT coalesce(sum(f.montant_global), 0) FROM dwh.fait_opportunite f "
                "JOIN dwh.dim_date d ON d.date_id = f.date_photo_id "
                "WHERE d.date IN (SELECT DISTINCT date_photo FROM staging.stg_opportunites)"
            ),
            "libelle": "Montant global des opportunités",
        },
        anonymiseur=anonymiseur(spark),
    )


if __name__ == "__main__":
    sys.exit(main())
