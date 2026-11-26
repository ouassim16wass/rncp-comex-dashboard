
import json
import os

import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException, Query

from lecture import lire
from metriques import installer

CLE = os.getenv("API_CLE", "")

ROUTES = {
    "sage/ca": ("CA facturé oct26 bon1 (1).xlsx", False, 0),
    "sage/marge": ("marge brute sept26 bon 2.xlsx", False, 0),
    "sage/echeances-clients": ("factures clients bon oct26.xlsx", False, 0),
    "sage/echeances-fournisseurs": ("factures fournisseurs oct26.xlsx", False, 1),
    "salesforce/opportunites": ("opportunites-20260409.xlsx", True, 2),
    "itop/tickets": ("Copie de excel Aurélie.xlsx", False, 0),
}

DATES_PHOTO = {
    "sage/echeances-clients": "2026-10-12",
    "sage/echeances-fournisseurs": "2026-10-12",
    "salesforce/opportunites": "2026-04-09",
}

os.environ.setdefault("SERVICE", "api-simulee")
app = FastAPI(title="Simulateur d'API", version="1.1")
installer(app, "api-simulee")
_cache: dict[str, pd.DataFrame] = {}


def charger(route: str) -> pd.DataFrame:
    if route not in _cache:
        fichier, salesforce, fin = ROUTES[route]
        df = lire(fichier, salesforce=salesforce)
        if route == "sage/ca":
            avant = lire("ca-facture-2025.xlsx")
            df = pd.concat([avant[avant["Date facture"] < df["Date facture"].min()], df], ignore_index=True)
        _cache[route] = df.iloc[:-fin] if fin else df
    return _cache[route]


def verifier_cle(x_api_key: str = Header(default="")):
    if not CLE or x_api_key != CLE:
        raise HTTPException(status_code=401, detail="Clé d'API absente ou invalide")


@app.get("/sante")
def sante():
    return {"etat": "ok", "routes": list(ROUTES)}


@app.get("/{systeme}/{ressource}", dependencies=[Depends(verifier_cle)])
def lister(systeme: str, ressource: str, page: int = Query(1, ge=1), taille: int = Query(5000, ge=1, le=20000)):
    route = f"{systeme}/{ressource}"
    if route not in ROUTES:
        raise HTTPException(status_code=404, detail=f"Ressource inconnue : {route}")
    df = charger(route)
    debut = (page - 1) * taille
    tranche = df.iloc[debut : debut + taille]
    donnees = json.loads(tranche.to_json(orient="records", date_format="iso", force_ascii=False))
    return {
        "route": route,
        "total": len(df),
        "page": page,
        "taille": taille,
        "date_photo": DATES_PHOTO.get(route),
        "donnees": donnees,
    }
