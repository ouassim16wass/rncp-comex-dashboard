
import json
import sys
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import api_simulee
import connecteurs


@pytest.fixture()
def client(monkeypatch):
    donnees = pd.DataFrame(
        {
            "Tiers": [f"C{i}" for i in range(25)],
            "Montant HT": [float(i) for i in range(25)],
            "Date facture": pd.date_range("2026-01-01", periods=25),
        }
    )
    monkeypatch.setattr(api_simulee, "charger", lambda route: donnees)
    return TestClient(api_simulee.app)


def test_sans_cle_acces_refuse(client):
    assert client.get("/sage/ca").status_code == 401


def test_page_et_total(client):
    r = client.get("/sage/ca", params={"page": 2, "taille": 10}, headers={"X-API-Key": api_simulee.CLE}).json()
    assert r["total"] == 25 and len(r["donnees"]) == 10 and r["donnees"][0]["Tiers"] == "C10"


def test_route_inconnue(client):
    assert client.get("/sage/inconnu", headers={"X-API-Key": api_simulee.CLE}).status_code == 404


def test_dates_en_texte_iso(client):
    ligne = client.get("/sage/ca", params={"taille": 1}, headers={"X-API-Key": api_simulee.CLE}).json()["donnees"][0]
    assert str(ligne["Date facture"]).startswith("2026-01-01")


def test_connecteur_depose_toutes_les_lignes(client, tmp_path):
    controle = connecteurs.collecter(
        "sage/ca", client=client, url_base="", cle=api_simulee.CLE, dossier=tmp_path, taille=10
    )
    assert controle["lignes_recues"] == 25 and controle["complet"]
    fichiers = list(tmp_path.rglob("*.jsonl"))
    assert len(fichiers) == 1
    lignes = [json.loads(x) for x in fichiers[0].read_text(encoding="utf-8").splitlines()]
    assert len(lignes) == 25 and lignes[-1]["Tiers"] == "C24"
    assert list(tmp_path.rglob("*.controle.json"))


def test_connecteur_mauvaise_cle(client, tmp_path):
    import httpx
    import requests

    with pytest.raises((requests.HTTPError, httpx.HTTPStatusError)):
        connecteurs.collecter("sage/ca", client=client, url_base="", cle="mauvaise", dossier=tmp_path)


def test_date_de_photo_fournie_par_l_api(client, tmp_path, monkeypatch):
    monkeypatch.setitem(api_simulee.DATES_PHOTO, "sage/ca", "2026-10-12")
    controle = connecteurs.collecter(
        "sage/ca", client=client, url_base="", cle=api_simulee.CLE, dossier=tmp_path, taille=10
    )
    assert controle["date_photo"] == "2026-10-12"
