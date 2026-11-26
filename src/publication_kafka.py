import json
import os
import sys
import time
from pathlib import Path

from kafka import KafkaProducer

from connecteurs import BRUT, dernier_depot
from journal import evenement, journal

logger = journal("publication-kafka")

SERVEURS = os.getenv("KAFKA_SERVEURS", "localhost:9094")

ROUTES_HEBDOMADAIRES = [
    "sage/echeances-clients",
    "sage/echeances-fournisseurs",
    "salesforce/opportunites",
    "itop/tickets",
]


def nom_topic(route: str) -> str:
    return "brut." + route.replace("/", ".")


def publier(route: str, producteur=None, dossier: Path = BRUT) -> dict:
    debut = time.time()
    fichier, controle = dernier_depot(route, dossier)
    if not controle["complet"]:
        raise ValueError(f"Dépôt incomplet pour {route} : publication refusée")
    producteur = producteur or KafkaProducer(
        bootstrap_servers=SERVEURS,
        value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
        acks="all",
        linger_ms=50,
        compression_type="gzip",
    )
    topic = nom_topic(route)
    envoyees = 0
    with open(fichier, encoding="utf-8") as f:
        for numero, ligne in enumerate(f, 1):
            message = {
                "route": route,
                "date_photo": controle["date_photo"],
                "numero_ligne": numero,
                "ligne": json.loads(ligne),
            }
            producteur.send(topic, value=message)
            envoyees += 1
    producteur.flush()
    evenement(logger, "publication_terminee", route=route, topic=topic, messages=envoyees, attendus=controle["lignes_recues"])
    return {
        "route": route,
        "topic": topic,
        "messages": envoyees,
        "attendus": controle["lignes_recues"],
        "complet": envoyees == controle["lignes_recues"],
        "duree_s": round(time.time() - debut, 1),
    }


if __name__ == "__main__":
    for r in sys.argv[1:] or ROUTES_HEBDOMADAIRES:
        c = publier(r)
        print(f"{c['topic']:40} {c['messages']:>8,} messages  complet={c['complet']}  {c['duree_s']} s".replace(",", " "))
