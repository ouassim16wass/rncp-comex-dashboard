
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

from journal import evenement, journal

RACINE = Path(__file__).resolve().parent.parent
BRUT = Path(os.getenv("DEPOT_BRUT", RACINE / "data" / "raw"))
logger = journal("connecteurs")
URL = os.getenv("API_URL", "http://localhost:8110")
CLE = os.getenv("API_CLE", "")


def appeler(client, url: str, params: dict, entetes: dict, essais: int = 3):
    for essai in range(1, essais + 1):
        try:
            r = client.get(url, params=params, headers=entetes)
            if r.status_code < 500:
                r.raise_for_status()
                return r.json()
        except requests.ConnectionError:
            if essai == essais:
                raise
        time.sleep(0.5 * essai)
    raise RuntimeError(f"Échec après {essais} essais : {url}")


def collecter(
    route: str, client=None, url_base: str = URL, cle: str = CLE, dossier: Path = BRUT, taille: int = 5000
) -> dict:
    client = client or requests.Session()
    debut = time.time()
    maintenant = datetime.now()
    sortie = Path(dossier) / route.replace("/", "_") / maintenant.strftime("%Y-%m-%d")
    sortie.mkdir(parents=True, exist_ok=True)
    fichier = sortie / f"{route.replace('/', '_')}_{maintenant:%H%M%S}.jsonl"
    nb, page, total, date_photo = 0, 1, None, None
    with open(fichier, "w", encoding="utf-8") as f:
        while total is None or nb < total:
            rep = appeler(client, f"{url_base}/{route}", {"page": page, "taille": taille}, {"X-API-Key": cle})
            total = rep["total"]
            date_photo = rep.get("date_photo") or date_photo
            for ligne in rep["donnees"]:
                f.write(json.dumps(ligne, ensure_ascii=False) + "\n")
            nb += len(rep["donnees"])
            if not rep["donnees"]:
                break
            page += 1
    controle = {
        "route": route,
        "fichier": fichier.name,
        "lignes_recues": nb,
        "lignes_annoncees": total,
        "complet": nb == total,
        "date_photo": date_photo or maintenant.isoformat(timespec="seconds"),
        "duree_s": round(time.time() - debut, 1),
    }
    (sortie / (fichier.stem + ".controle.json")).write_text(
        json.dumps(controle, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    evenement(
        logger,
        "collecte_terminee",
        "info" if controle["complet"] else "error",
        route=route,
        lignes_recues=nb,
        lignes_annoncees=total,
        complet=controle["complet"],
        duree_s=controle["duree_s"],
    )
    return controle


def dernier_depot(route: str, dossier: Path = BRUT) -> tuple[Path, dict]:
    base = Path(dossier) / route.replace("/", "_")
    controles = sorted(base.glob("*/*.controle.json"))
    if not controles:
        raise FileNotFoundError(f"Aucun dépôt brut pour {route}")
    controle = json.loads(controles[-1].read_text(encoding="utf-8"))
    return controles[-1].parent / controle["fichier"], controle




if __name__ == "__main__":
    routes = sys.argv[1:] or [
        "sage/ca",
        "sage/marge",
        "sage/echeances-clients",
        "sage/echeances-fournisseurs",
        "salesforce/opportunites",
        "itop/tickets",
    ]
    for r in routes:
        c = collecter(r)
        print(f"{r:32} {c['lignes_recues']:>9,} lignes  complet={c['complet']}  {c['duree_s']} s".replace(",", " "))
