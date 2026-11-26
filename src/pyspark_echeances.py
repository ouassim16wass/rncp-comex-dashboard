import sys

from pyspark.sql import functions as F

import pyspark_commun as pc

CONTRAT = "sage_echeances"
FLUX = {
    "clients": {"route": "sage/echeances-clients", "fichier": "factures clients", "sens": "créance"},
    "fournisseurs": {"route": "sage/echeances-fournisseurs", "fichier": "factures fournisseurs", "sens": "dette"},
}


def tranche(jours):
    return (
        F.when(jours < 0, "non échu")
        .when(jours < 15, "moins de 15 jours")
        .when(jours <= 30, "15 à 30 jours")
        .otherwise("plus de 30 jours")
    )


def transformateur(flux: str):
    def transformer(valides):
        photo = F.to_date(F.substring(F.col("date_photo"), 1, 10))
        if flux == "clients":
            echeance = F.to_date(F.substring(F.col("`Date Ech.`"), 1, 10))
            base = valides.select(
                photo.alias("date_photo"),
                F.col("Client").alias("code_sage"),
                F.col("`Lib. Client`").alias("raison_sociale_pseudo"),
                F.col("Groupe/HG").alias("segment_source"),
                echeance.alias("date_echeance"),
                F.col("Solde").cast("double").alias("solde"),
                F.lit(None).cast("string").alias("type_piece"),
                F.lit(None).cast("string").alias("reference_piece"),
            )
            base = base.withColumn(
                "segment",
                F.when(F.col("segment_source") == "GROUPE", "Groupe")
                .when(F.col("segment_source") == "HORS GROUPE", "Hors groupe")
                .when(F.col("segment_source") == "PUBLIC", "Public")
                .when(F.col("segment_source") == "DOUTEUX", "Douteux"),
            ).drop("segment_source")
        else:
            echeance = F.to_date(F.substring(F.col("Echéance"), 1, 10))
            base = valides.select(
                photo.alias("date_photo"),
                F.col("Tiers").alias("code_sage"),
                F.lit(None).cast("string").alias("raison_sociale_pseudo"),
                F.lit(None).cast("string").alias("segment"),
                echeance.alias("date_echeance"),
                F.col("Solde total").cast("double").alias("solde"),
                F.col("Colonne1").alias("type_piece"),
                F.col("Référence").alias("reference_piece"),
            )
        base = base.withColumn("sens", F.lit(FLUX[flux]["sens"]))
        base = base.withColumn("jours_retard", F.datediff(F.col("date_photo"), F.col("date_echeance")))
        base = base.withColumn("tranche_retard", tranche(F.col("jours_retard")))
        if pc.PROFIL != "demo":
            return base
        return (
            base.withColumn(
                "raison_sociale_pseudo",
                F.when(F.col("raison_sociale_pseudo").isNotNull(), F.concat(F.lit("Client "), F.substring(pc.empreinte(F.col("code_sage")), 1, 6))),
            )
            .withColumn("code_sage", F.concat(F.lit("T"), F.substring(pc.empreinte(F.col("code_sage")), 1, 8)))
            .withColumn("solde", F.round(F.col("solde") * pc.COEFFICIENT, 2))
        )

    return transformer


def anonymiseur(flux: str):
    def anonymiser(brut):
        if flux == "clients":
            return pc.anonymiser_brut(
                brut,
                client=F.col("Client"),
                ligne=F.concat_ws("|", F.col("Client"), F.col("`Date Ech.`"), F.col("Solde")),
                montants=["Solde"],
                dates=["Date Ech.", "date_photo"],
                categories=[F.col("`Groupe/HG`")],
                jours=pc.decalage_jours("echeances"),
            )
        return pc.anonymiser_brut(
            brut,
            client=F.col("Tiers"),
            ligne=F.concat_ws("|", F.col("Tiers"), F.col("Référence"), F.col("`Solde total`")),
            montants=["Solde total"],
            dates=["Echéance", "date_photo"],
            jours=pc.decalage_jours("echeances"),
        )

    return anonymiser


def main(flux: str) -> int:
    f = FLUX[flux]
    comptage = (
        "SELECT count(*) FROM dwh.fait_echeance f JOIN dwh.dim_date d ON d.date_id = f.date_photo_id "
        f"WHERE f.sens = '{f['sens']}' AND d.date IN (SELECT DISTINCT date_photo FROM staging.stg_echeances)"
    )
    return pc.executer_job(
        f"pyspark_echeances_{flux}",
        f["route"],
        CONTRAT,
        transformateur(flux),
        "stg_echeances",
        ["02_referentiels.sql", "05_charger_echeances.sql"],
        comptage,
        lecteur=pc.lire_kafka(f["route"]),
        fichier_contrat=f["fichier"],
        controle={
            "brute": "Solde" if flux == "clients" else "Solde total",
            "staging": "solde",
            "entrepot": (
                "SELECT sum(f.solde) FROM dwh.fait_echeance f JOIN dwh.dim_date d ON d.date_id = f.date_photo_id "
                f"WHERE f.sens = '{f['sens']}' AND d.date IN (SELECT DISTINCT date_photo FROM staging.stg_echeances)"
            ),
            "libelle": "Solde des pièces ouvertes",
        },
        anonymiseur=anonymiseur(flux),
    )


if __name__ == "__main__":
    sys.exit(max(main(flux) for flux in (sys.argv[1:] or list(FLUX))))
