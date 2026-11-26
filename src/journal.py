import json
import logging
import os
import sys
import time
from contextlib import contextmanager


class FormatJson(logging.Formatter):
    def format(self, enregistrement: logging.LogRecord) -> str:
        ligne = {
            "horodatage": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(enregistrement.created))
            + f".{int(enregistrement.msecs):03d}Z",
            "niveau": enregistrement.levelname.lower(),
            "service": os.getenv("SERVICE", "inconnu"),
            "evenement": enregistrement.getMessage(),
        }
        ligne.update(getattr(enregistrement, "champs", {}))
        if enregistrement.exc_info:
            ligne["erreur"] = self.formatException(enregistrement.exc_info)
        return json.dumps(ligne, ensure_ascii=False, default=str)


def journal(nom: str = "entreprise") -> logging.Logger:
    logger = logging.getLogger(nom)
    if not logger.handlers:
        gestionnaire = logging.StreamHandler(sys.stdout)
        gestionnaire.setFormatter(FormatJson())
        logger.addHandler(gestionnaire)
        fichier = os.getenv("JOURNAL_FICHIER")
        if fichier:
            os.makedirs(os.path.dirname(fichier), exist_ok=True)
            persistant = logging.FileHandler(fichier, encoding="utf-8")
            persistant.setFormatter(FormatJson())
            logger.addHandler(persistant)
        logger.setLevel(os.getenv("NIVEAU_JOURNAL", "INFO").upper())
        logger.propagate = False
    return logger


def evenement(logger: logging.Logger, message: str, niveau: str = "info", **champs) -> None:
    getattr(logger, niveau)(message, extra={"champs": champs})


@contextmanager
def chronometre(logger: logging.Logger, message: str, **champs):
    debut = time.time()
    try:
        yield
    except Exception:
        evenement(logger, f"{message}_echec", "error", duree_s=round(time.time() - debut, 3), **champs)
        raise
    evenement(logger, message, duree_s=round(time.time() - debut, 3), **champs)
