import os
import re

import pytest

psycopg = pytest.importorskip("psycopg")


def connexion(base):
    mot_de_passe = os.getenv("PG_MOT_DE_PASSE")
    if not mot_de_passe:
        pytest.skip("Base non configurée")
    try:
        return psycopg.connect(
            host=os.getenv("PG_HOTE", "localhost"),
            port=os.getenv("PG_PORT", "5442"),
            dbname=base,
            user=os.getenv("PG_UTILISATEUR", "entrepot"),
            password=mot_de_passe,
            connect_timeout=3,
        )
    except psycopg.OperationalError:
        pytest.skip(f"Base {base} injoignable")


MOTIF_NOM = re.compile(r"^(Client [0-9a-f]{6}|Tiers T[0-9a-f]{8}|Non rapproché)$")
MOTIF_CODE = re.compile(r"^(T[0-9a-f]{8}|NON_RAPPROCHE)$")


def test_la_base_de_demonstration_ne_contient_que_des_pseudonymes():
    with connexion("entrepot_demo") as c:
        noms = [r[0] for r in c.execute("SELECT raison_sociale_pseudo FROM dwh.dim_tiers").fetchall()]
        codes = [r[0] for r in c.execute("SELECT code_sage FROM dwh.dim_tiers").fetchall()]
    assert noms and all(MOTIF_NOM.match(n) for n in noms), [n for n in noms if not MOTIF_NOM.match(n)][:3] and "nom non pseudonymisé"
    assert all(MOTIF_CODE.match(c) for c in codes)


def test_aucun_code_reel_dans_la_base_de_demonstration():
    with connexion("entrepot") as reel, connexion("entrepot_demo") as demo:
        codes_reels = {r[0] for r in reel.execute("SELECT code_sage FROM dwh.dim_tiers").fetchall()}
        codes_demo = {r[0] for r in demo.execute("SELECT code_sage FROM dwh.dim_tiers").fetchall()}
    assert codes_reels - {"NON_RAPPROCHE"}, "la base réelle est vide"
    assert not (codes_reels & codes_demo) - {"NON_RAPPROCHE"}


def test_les_montants_de_demonstration_sont_transformes():
    with connexion("entrepot") as reel, connexion("entrepot_demo") as demo:
        total_reel = reel.execute("SELECT sum(montant_ht) FROM dwh.fait_facturation").fetchone()[0]
        total_demo = demo.execute("SELECT sum(montant_ht) FROM dwh.fait_facturation").fetchone()[0]
    assert total_reel and total_demo and abs(float(total_reel) - float(total_demo)) > 1


def test_la_demonstration_ne_reprend_ni_les_volumes_ni_les_dates_du_reel():
    requetes = {
        "lignes": "SELECT count(*) FROM dwh.fait_facturation",
        "clients": "SELECT count(DISTINCT tiers_id) FROM dwh.fait_facturation",
        "premiere_date": "SELECT min(d.date) FROM dwh.fait_facturation f JOIN dwh.dim_date d ON d.date_id = f.date_facture_id",
        "derniere_date": "SELECT max(d.date) FROM dwh.fait_facturation f JOIN dwh.dim_date d ON d.date_id = f.date_facture_id",
        "photo_echeances": "SELECT max(d.date) FROM dwh.fait_echeance f JOIN dwh.dim_date d ON d.date_id = f.date_photo_id",
        "tickets": "SELECT count(*) FROM staging.stg_tickets",
    }
    with connexion("entrepot") as reel, connexion("entrepot_demo") as demo:
        for nom, requete in requetes.items():
            assert reel.execute(requete).fetchone()[0] != demo.execute(requete).fetchone()[0], nom
