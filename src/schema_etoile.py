
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

SORTIE = Path(__file__).resolve().parent.parent / "docs" / "figures" / "modele_etoile.png"

FAITS = {
    "fait_facturation": (
        2.0,
        3.0,
        [
            "grain : une ligne de facture",
            "mesures : montant_ht, quantite, prix_brut",
            "date_facture_id, mois_facturation_id",
            "client_id, produit_id, domaine_id",
            "commercial_id, compte_id",
            "no_facture, type_facture (facture/avoir)",
        ],
    ),
    "fait_echeance_client": (
        6.0,
        3.0,
        [
            "grain : une pièce à une date de photo",
            "mesures : debit, credit, solde,",
            "jours_retard, tranche_retard (calculés)",
            "date_photo_id, date_echeance_id",
            "client_id, no_piece",
        ],
    ),
    "fait_opportunite": (
        10.0,
        3.0,
        [
            "grain : une opportunité à une date de photo",
            "mesures : montant_global, nb_mois",
            "date_photo_id, client_id",
            "commercial_id, domaine_id, statut_id",
        ],
    ),
    "fait_ticket": (
        14.0,
        3.0,
        [
            "grain : un ticket",
            "mesures : delai_resolution, sla_ttr_depasse,",
            "sla_tto_depasse, lie_salesforce",
            "date_creation_id, date_resolution_id",
            "client_id, equipe_id, profil_ticket_id",
        ],
    ),
}
DIMS = {
    "dim_date": (1.0, 7.0, ["date, mois_civil, trimestre, annee", "semaine, jour_ouvre"]),
    "dim_mois_facturation": (4.6, 7.0, ["mois_sage, annee", "(règle du ~20 à confirmer)"]),
    "dim_client": (8.0, 7.0, ["raison_sociale_pseudo, groupe_hg", "type_entite (CR / entité / hors groupe)"]),
    "dim_domaine": (12.0, 7.0, ["domaine (D1 à D4), build_run", "code_service"]),
    "dim_commercial": (15.5, 7.0, ["commercial_pseudo"]),
    "dim_produit": (1.0, -1.0, ["article, designation_pseudo", "famille_statistique"]),
    "dim_compte": (4.5, -1.0, ["compte_general, intitule", "negoce / hors négoce"]),
    "dim_statut_opportunite": (8.5, -1.0, ["etape, motif_cloture, type_affaire", "est_gagnee"]),
    "dim_equipe": (12.0, -1.0, ["equipe, famille_service"]),
    "dim_profil_ticket": (15.5, -1.0, ["type, priorite, etat", "impact, urgence"]),
}
LIENS = [
    ("fait_facturation", "dim_date"),
    ("fait_facturation", "dim_mois_facturation"),
    ("fait_facturation", "dim_client"),
    ("fait_facturation", "dim_domaine"),
    ("fait_facturation", "dim_commercial"),
    ("fait_facturation", "dim_produit"),
    ("fait_facturation", "dim_compte"),
    ("fait_echeance_client", "dim_date"),
    ("fait_echeance_client", "dim_client"),
    ("fait_opportunite", "dim_date"),
    ("fait_opportunite", "dim_client"),
    ("fait_opportunite", "dim_commercial"),
    ("fait_opportunite", "dim_domaine"),
    ("fait_opportunite", "dim_statut_opportunite"),
    ("fait_ticket", "dim_date"),
    ("fait_ticket", "dim_client"),
    ("fait_ticket", "dim_equipe"),
    ("fait_ticket", "dim_profil_ticket"),
]
L_FAIT, H_FAIT = 3.7, 2.3
L_DIM, H_DIM = 3.0, 1.0


def boite(ax, nom, x, y, lignes, largeur, hauteur, fond, bord):
    ax.add_patch(
        FancyBboxPatch(
            (x - largeur / 2, y - hauteur / 2),
            largeur,
            hauteur,
            boxstyle="round,pad=0.02,rounding_size=0.12",
            fc=fond,
            ec=bord,
            lw=1.4,
            zorder=3,
        )
    )
    ax.text(x, y + hauteur / 2 - 0.22, nom, ha="center", va="center", fontsize=8.5, fontweight="bold", zorder=4)
    for i, t in enumerate(lignes):
        ax.text(x, y + hauteur / 2 - 0.55 - i * 0.28, t, ha="center", va="center", fontsize=6.3, zorder=4)


def main():
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(17, 8.5))
    pos = {}
    for n, (x, y, t) in FAITS.items():
        pos[n] = (x, y, L_FAIT, H_FAIT)
    for n, (x, y, t) in DIMS.items():
        pos[n] = (x, y, L_DIM, H_DIM)
    for f, d in LIENS:
        xf, yf, _, hf = pos[f]
        xd, yd, _, hd = pos[d]
        y1 = yf + hf / 2 if yd > yf else yf - hf / 2
        y2 = yd - hd / 2 if yd > yf else yd + hd / 2
        ax.plot([xf, xd], [y1, y2], color="#7f8c8d", lw=0.9, zorder=1)
    for n, (x, y, t) in FAITS.items():
        boite(ax, n, x, y, t, L_FAIT, H_FAIT, "#d6e6f5", "#1f4e79")
    for n, (x, y, t) in DIMS.items():
        boite(ax, n, x, y, t, L_DIM, H_DIM, "#e3f2e1", "#2e7d32")
    ax.text(
        8.0,
        -2.1,
        "Faits (en bleu) liés aux dimensions partagées (en vert) : constellation",
        ha="center",
        fontsize=9.5,
        style="italic",
    )
    ax.text(
        8.0,
        -2.6,
        "Hors étoile : table de correspondance des clients (Sage, Salesforce, iTop) qui alimente dim_client.",
        ha="center",
        fontsize=8.5,
        color="#555",
    )
    ax.set_xlim(-1, 17.5)
    ax.set_ylim(-3, 8.3)
    ax.axis("off")
    ax.set_title("Modèle en étoile de l'entrepôt (MVP : 4 faits)", fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(SORTIE, dpi=150)
    plt.close(fig)
    print("Figure écrite :", SORTIE)


if __name__ == "__main__":
    main()
