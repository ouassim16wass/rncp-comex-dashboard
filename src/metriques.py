import time
import uuid

from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

from journal import evenement, journal

REQUETES = Counter("requetes_total", "Requêtes HTTP reçues", ["service", "route", "methode", "code"])
DUREES = Histogram(
    "duree_requete_secondes",
    "Durée de traitement des requêtes HTTP",
    ["service", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)


def installer(app: FastAPI, service: str, avant_metriques=None) -> None:
    logger = journal(service)

    @app.middleware("http")
    async def suivre(requete: Request, suite):
        identifiant = requete.headers.get("x-request-id", uuid.uuid4().hex[:12])
        debut = time.time()
        code = 500
        try:
            reponse = await suite(requete)
            code = reponse.status_code
            reponse.headers["x-request-id"] = identifiant
            return reponse
        finally:
            route = requete.scope.get("route")
            chemin = route.path if route else "inconnue"
            duree = time.time() - debut
            REQUETES.labels(service, chemin, requete.method, str(code)).inc()
            DUREES.labels(service, chemin).observe(duree)
            if chemin != "/metrics":
                evenement(
                    logger,
                    "requete",
                    "warning" if code >= 400 else "info",
                    identifiant=identifiant,
                    methode=requete.method,
                    route=chemin,
                    code=code,
                    duree_ms=round(duree * 1000, 1),
                )

    @app.get("/metrics", include_in_schema=False)
    def metriques():
        if avant_metriques:
            avant_metriques()
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
