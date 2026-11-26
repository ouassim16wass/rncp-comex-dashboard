import hashlib
import json
import os
import time
from functools import reduce
from pathlib import Path

import psycopg
import yaml
from pyspark.sql import SparkSession, Window
from pyspark.sql import functions as F

from journal import evenement, journal

logger = journal("pyspark")
RACINE = Path(__file__).resolve().parent.parent
DATA = RACINE / "data"
DB = RACINE / "db"
BRUT = Path(os.getenv("DEPOT_BRUT", DATA / "raw"))
QUARANTAINE = DATA / "quarantaine"

PROFIL = os.getenv("PROFIL", "reel")
BASE = "entrepot_demo" if PROFIL == "demo" else "entrepot"
HOTE = os.getenv("PG_HOTE", "localhost")
PORT = os.getenv("PG_PORT", "5442")
UTILISATEUR = os.getenv("PG_UTILISATEUR", "entrepot")
MOT_DE_PASSE = os.getenv("PG_MOT_DE_PASSE", "")
SECRET = os.getenv("SECRET_PSEUDONYMISATION", "")
COEFFICIENT = float(os.getenv("COEFFICIENT_MONTANTS", "1"))
RETRAIT_POURCENT = int(os.getenv("ANON_RETRAIT_POURCENT", "15"))
DECALAGE_MOIS = int(os.getenv("ANON_DECALAGE_MOIS", "12"))
FACTEUR_MIN = float(os.getenv("ANON_FACTEUR_MIN", "0.6"))
FACTEUR_MAX = float(os.getenv("ANON_FACTEUR_MAX", "1.6"))
SEL_ANONYMISATION = os.getenv("ANON_SEL", "d")
FACTEURS_CATEGORIE = {"G": 0.8, "HG": 1.25, "GROUPE": 0.8, "HORS GROUPE": 1.25, "RUN": 0.92, "BUILD": 1.15}
FACTEURS_ANNEE = {"2025": 1.03, "2026": 0.96}
BRUIT_MIN = float(os.getenv("ANON_BRUIT_MIN", "0.8"))
BRUIT_MAX = float(os.getenv("ANON_BRUIT_MAX", "1.25"))

URL_JDBC = f"jdbc:postgresql://{HOTE}:{PORT}/{BASE}"
PROPRIETES = {"user": UTILISATEUR, "password": MOT_DE_PASSE, "driver": "org.postgresql.Driver"}

TYPES = {"texte": "string", "entier": "long", "décimal": "double", "date": "date", "booléen": "boolean"}


def creer_session() -> SparkSession:
    return (
        SparkSession.builder.appName("entrepot-entreprise")
        .master("local[2]")
        .config("spark.driver.memory", "3g")
        .config("spark.sql.ansi.enabled", "false")
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.ui.enabled", "false")
        .getOrCreate()
    )


def charger_contrat(nom: str) -> dict:
    return yaml.safe_load((DATA / f"contrat_{nom}.yaml").read_text(encoding="utf-8"))


def connexion():
    return psycopg.connect(host=HOTE, port=PORT, dbname=BASE, user=UTILISATEUR, password=MOT_DE_PASSE)


def executer_sql(nom: str):
    with connexion() as c:
        c.execute((DB / nom).read_text(encoding="utf-8"))


def dernier_fichier(route: str) -> tuple[Path, dict]:
    base = BRUT / route.replace("/", "_")
    controles = sorted(base.glob("*/*.controle.json"))
    if not controles:
        raise FileNotFoundError(f"Aucun dépôt brut pour {route}")
    controle = json.loads(controles[-1].read_text(encoding="utf-8"))
    return controles[-1].parent / controle["fichier"], controle


def colonne_typee(nom: str, type_contrat: str):
    c = F.col(f"`{nom}`")
    if type_contrat == "date":
        return F.to_date(F.substring(c.cast("string"), 1, 10))
    if type_contrat == "booléen":
        minuscule = F.lower(F.trim(c.cast("string")))
        return F.when(minuscule.isin("oui", "true", "1"), True).when(minuscule.isin("non", "false", "0"), False)
    return c.cast(TYPES[type_contrat])


def regles_controle(contrat: dict, colonnes: list[str]) -> dict:
    regles = {}
    for col in contrat["colonnes"]:
        source = col["source"]
        if source not in colonnes:
            continue
        brut = F.col(f"`{source}`")
        controles = col.get("controles") or {}
        gravite = controles.get("gravite", "erreur")
        if col["obligatoire"] or controles.get("non_nul"):
            regles[f"{source} : valeur absente"] = (brut.isNull() | (F.trim(brut.cast("string")) == ""), gravite)
        if col["type"] != "texte":
            typee = colonne_typee(source, col["type"])
            regles[f"{source} : type {col['type']} invalide"] = (brut.isNotNull() & typee.isNull(), "erreur")
        if "valeurs" in controles:
            regles[f"{source} : valeur hors liste"] = (
                brut.isNotNull() & ~brut.cast("string").isin(controles["valeurs"]),
                gravite,
            )
        if controles.get("unique"):
            regles[f"{source} : doublon"] = (F.count(F.lit(1)).over(Window.partitionBy(brut)) > 1, gravite)
        if "min" in controles:
            regles[f"{source} : sous le minimum"] = (brut.cast("double") < controles["min"], gravite)
        if "max" in controles:
            regles[f"{source} : au-dessus du maximum"] = (brut.cast("double") > controles["max"], gravite)
    return regles


def valider(df, contrat: dict):
    regles = regles_controle(contrat, df.columns)
    absentes = [c["source"] for c in contrat["colonnes"] if c["obligatoire"] and c["source"] not in df.columns]
    if absentes:
        raise ValueError(f"Colonnes obligatoires absentes : {absentes}")
    noms = list(regles)
    marques = df
    for i, nom in enumerate(noms):
        marques = marques.withColumn(f"_r{i}", F.coalesce(regles[nom][0], F.lit(False)))
    colonnes_regles = [f"_r{i}" for i in range(len(noms))]
    erreurs = [F.col(f"_r{i}") for i, nom in enumerate(noms) if regles[nom][1] == "erreur"]
    marques = marques.withColumn("_rejet", reduce(lambda a, b: a | b, erreurs, F.lit(False)))
    mesures = marques.agg(
        F.count(F.lit(1)).alias("lues"),
        F.sum(F.col("_rejet").cast("int")).alias("rejetees"),
        *[F.sum(F.col(c).cast("int")).alias(c) for c in colonnes_regles],
    ).first()
    lues, rejetees = mesures["lues"], mesures["rejetees"] or 0
    detail = {
        nom: {"lignes": mesures[f"_r{i}"] or 0, "gravite": regles[nom][1]}
        for i, nom in enumerate(noms)
        if mesures[f"_r{i}"]
    }
    stats = {
        "lues": lues,
        "rejetees": rejetees,
        "taux_rejet": rejetees / lues if lues else 0,
        "detail": detail,
    }
    nettoyees = marques.drop(*colonnes_regles)
    return nettoyees.filter(~F.col("_rejet")).drop("_rejet"), nettoyees.filter(F.col("_rejet")).drop("_rejet"), stats


def isoler_quarantaine(rejetees, contrat_nom: str):
    chemin = QUARANTAINE / contrat_nom / time.strftime("%Y%m%d_%H%M%S")
    rejetees.write.mode("overwrite").parquet(str(chemin))
    return chemin


def enregistrer_execution(
    etape: str, source: str, duree_s: float, stats: dict, statut: str, message: str, sommes: dict | None = None
):
    sommes = sommes or {}
    with connexion() as c:
        execution_id = c.execute(
            "INSERT INTO supervision.execution (etape, source, duree_s, lignes_lues, lignes_chargees, lignes_rejetees,"
            " taux_rejet, statut, message, somme_brute, somme_staging, somme_entrepot, mesure_controlee)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING execution_id",
            (
                etape,
                source,
                round(duree_s, 2),
                stats["lues"],
                stats["lues"] - stats["rejetees"],
                stats["rejetees"],
                round(stats["taux_rejet"], 4),
                statut,
                message,
                sommes.get("brute"),
                sommes.get("staging"),
                sommes.get("entrepot"),
                sommes.get("mesure"),
            ),
        ).fetchone()[0]
        for regle, d in stats["detail"].items():
            c.execute(
                "INSERT INTO supervision.quarantaine (execution_id, source, regle, nb_lignes) VALUES (%s, %s, %s, %s)",
                (execution_id, source, f"{regle} ({d['gravite']})", d["lignes"]),
            )
    return execution_id


def normaliser(colonne):
    sans_accents = F.translate(F.upper(colonne), "ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ", "AAAEEEEIIOOUUUC")
    propre = F.regexp_replace(sans_accents, "[^A-Z0-9 ]", " ")
    return F.trim(F.regexp_replace(propre, " +", " "))


def cle_personne(colonne):
    return F.concat_ws(" ", F.array_sort(F.split(normaliser(colonne), " ")))


def empreinte(valeur):
    return F.sha2(F.concat(F.lit(SECRET), valeur.cast("string")), 256)


def entier_pseudonyme(valeur, modulo: int, decalage: int):
    return (F.conv(F.substring(empreinte(valeur), 1, 8), 16, 10).cast("long") % modulo + decalage).cast("long")


def tirage(sel: str, *colonnes):
    base = F.concat_ws("|", F.lit(SECRET), F.lit(SEL_ANONYMISATION), F.lit(sel), *[c.cast("string") for c in colonnes])
    h = F.conv(F.substring(F.sha2(base, 256), 1, 8), 16, 10).cast("long")
    return (h % 1000000) / 1000000.0


def decalage_jours(nom: str) -> int:
    return int(hashlib.sha256((SECRET + nom).encode("utf-8")).hexdigest()[:6], 16) % 41 - 20


def decaler_date(colonne, jours: int = 0):
    jour = F.to_date(F.substring(colonne.cast("string"), 1, 10))
    decale = F.concat(F.date_format(F.date_add(F.add_months(jour, -DECALAGE_MOIS), jours), "yyyy-MM-dd"), F.substring(colonne.cast("string"), 11, 100))
    return F.when(jour.isNotNull(), decale).otherwise(colonne)


def anonymiser_brut(df, client=None, ligne=None, montants=(), dates=(), bruit=None, annee=None, categories=(), jours=0):
    cle_ligne = ligne if ligne is not None else F.monotonically_increasing_id()
    cle_retrait = F.coalesce(client.cast("string"), cle_ligne.cast("string")) if client is not None else cle_ligne.cast("string")
    garde = tirage("retrait", cle_retrait) >= RETRAIT_POURCENT / 100.0
    df = df.filter(garde)
    facteur = F.lit(1.0)
    if client is not None:
        facteur = F.lit(FACTEUR_MIN) + tirage("facteur", cle_retrait) * (FACTEUR_MAX - FACTEUR_MIN)
    if bruit is not None:
        facteur = facteur * (F.lit(BRUIT_MIN) + tirage("bruit", cle_retrait, bruit) * (BRUIT_MAX - BRUIT_MIN))
    elif client is None:
        facteur = F.lit(BRUIT_MIN) + tirage("bruit", cle_retrait) * (BRUIT_MAX - BRUIT_MIN)
    if annee is not None:
        cle_annee = F.substring(annee.cast("string"), 1, 4)
        carte = F.create_map(*[x for k, v in FACTEURS_ANNEE.items() for x in (F.lit(k), F.lit(v))])
        facteur = facteur * F.coalesce(carte[cle_annee], F.lit(0.85) + tirage("annee", cle_annee) * 0.35)
    for categorie in categories:
        carte = F.create_map(*[x for k, v in FACTEURS_CATEGORIE.items() for x in (F.lit(k), F.lit(v))])
        facteur = facteur * F.coalesce(carte[F.upper(F.trim(categorie.cast("string")))], F.lit(0.55) + tirage("categorie-b", categorie) * 0.9)
    for nom in montants:
        c = F.col(f"`{nom}`")
        df = df.withColumn(nom, F.when(c.cast("double").isNotNull(), (c.cast("double") * facteur)).otherwise(c.cast("double")))
    for nom in dates:
        df = df.withColumn(nom, decaler_date(F.col(f"`{nom}`"), jours))
    return df


def ecrire_staging(df, table: str):
    df.write.jdbc(URL_JDBC, f"staging.{table}", mode="overwrite", properties=PROPRIETES)


def compter(table: str) -> int:
    with connexion() as c:
        return c.execute(f"SELECT count(*) FROM {table}").fetchone()[0]


def lire_depot(route: str):
    def lecteur(spark):
        fichier, controle = dernier_fichier(route)
        if not controle["complet"]:
            raise ValueError("Dépôt brut incomplet")
        return spark.read.json(str(fichier))

    return lecteur


def lire_kafka(route: str):
    topic = "brut." + route.replace("/", ".")

    def lecteur(spark):
        messages = (
            spark.read.format("kafka")
            .option("kafka.bootstrap.servers", os.getenv("KAFKA_SERVEURS", "localhost:9094"))
            .option("subscribe", topic)
            .option("startingOffsets", "earliest")
            .option("endingOffsets", "latest")
            .load()
            .select(F.col("value").cast("string").alias("valeur"))
        )
        enveloppes = spark.read.json(messages.rdd.map(lambda r: r.valeur))
        derniere = enveloppes.groupBy(F.substring("date_photo", 1, 10).alias("jour")).agg(F.max("date_photo").alias("retenue"))
        retenues = enveloppes.join(derniere, (F.substring(enveloppes["date_photo"], 1, 10) == derniere["jour"]) & (enveloppes["date_photo"] == derniere["retenue"]))
        return retenues.select(enveloppes["date_photo"], "ligne.*")

    return lecteur


def executer_job(
    etape: str,
    source: str,
    contrat_nom: str,
    transformer,
    staging: str,
    scripts: list[str],
    comptage: str,
    lecteur=None,
    fichier_contrat: str | None = None,
    controle: dict | None = None,
    anonymiseur=None,
) -> int:
    debut = time.time()
    spark = creer_session()
    contrat = charger_contrat(contrat_nom)
    if fichier_contrat:
        contrat["colonnes"] = [c for c in contrat["colonnes"] if c.get("fichier") in (None, fichier_contrat)]
    evenement(logger, "job_demarre", etape=etape, source=source, profil=PROFIL)
    brut = (lecteur or lire_depot(source))(spark)
    if PROFIL == "demo" and anonymiseur is not None:
        brut = anonymiseur(brut)
    brut = brut.cache()
    somme_brute = None
    if controle:
        mesure_brute = F.col(f"`{controle['brute']}`").cast("double")
        if PROFIL == "demo":
            mesure_brute = F.round(mesure_brute * COEFFICIENT, 2)
        somme_brute = brut.agg(F.sum(mesure_brute)).first()[0]
    valides, rejetees, stats = valider(brut, contrat)
    maximum = contrat["qualite_globale"]["taux_rejet_max"]
    evenement(
        logger, "validation_terminee", etape=etape, lues=stats["lues"], rejetees=stats["rejetees"], taux_rejet=round(stats["taux_rejet"], 5)
    )
    if stats["taux_rejet"] > maximum:
        evenement(logger, "seuil_de_rejet_depasse", "error", etape=etape, taux_rejet=round(stats["taux_rejet"], 5), seuil=maximum)
        isoler_quarantaine(rejetees, contrat_nom)
        message = f"Taux de rejet {stats['taux_rejet']:.2%} au-dessus du seuil {maximum:.0%} : chargement refusé"
        enregistrer_execution(etape, source, time.time() - debut, stats, "echec", message)
        print(message)
        return 1
    if stats["rejetees"]:
        isoler_quarantaine(rejetees, contrat_nom)
    ecrire_staging(transformer(valides), staging)
    attendu = compter(f"staging.{staging}")
    for script in scripts:
        executer_sql(script)
    with connexion() as c:
        charge = c.execute(comptage).fetchone()[0]
        sommes = None
        if controle:
            sommes = {
                "brute": float(somme_brute or 0),
                "staging": float(c.execute(f"SELECT coalesce(sum({controle['staging']}), 0) FROM staging.{staging}").fetchone()[0]),
                "entrepot": float(c.execute(controle["entrepot"]).fetchone()[0] or 0),
                "mesure": controle["libelle"],
            }
    if charge != attendu:
        message = f"{charge} lignes chargées pour {attendu} attendues"
        enregistrer_execution(etape, source, time.time() - debut, stats, "echec", message)
        print(message)
        return 1
    avertissements = [r for r, d in stats["detail"].items() if d["gravite"] != "erreur"]
    statut = "alerte" if avertissements else "ok"
    message = f"profil {PROFIL}, {len(avertissements)} règle(s) en avertissement"
    enregistrer_execution(etape, source, time.time() - debut, stats, statut, message, sommes)
    evenement(
        logger,
        "job_termine",
        "warning" if statut == "alerte" else "info",
        etape=etape,
        statut=statut,
        lues=stats["lues"],
        chargees=charge,
        duree_s=round(time.time() - debut, 2),
        somme_entrepot=(sommes or {}).get("entrepot"),
    )
    print(f"{source} : {stats['lues']} lues, {stats['rejetees']} rejetées, {charge} chargées, statut {statut}")
    return 0
