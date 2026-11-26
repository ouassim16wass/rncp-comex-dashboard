import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import psycopg

RACINE = Path(__file__).resolve().parent.parent
SORTIE = Path(os.getenv("DOSSIER_FIGURES", RACINE / "docs" / "figures"))


def clients_par_mois():
    with psycopg.connect(
        host=os.getenv("PG_HOTE", "localhost"),
        port=os.getenv("PG_PORT", "5442"),
        dbname=os.getenv("PG_BASE", "entrepot_demo"),
        user=os.getenv("PG_UTILISATEUR", "entrepot"),
        password=os.getenv("PG_MOT_DE_PASSE", ""),
    ) as c:
        return c.execute(
            "SELECT to_char(d.date, 'YYYY-MM'), count(DISTINCT f.tiers_id) FROM dwh.fait_facturation f "
            "JOIN dwh.dim_date d ON d.date_id = f.date_facture_id GROUP BY 1 ORDER BY 1"
        ).fetchall()


def main():
    lignes = clients_par_mois()
    mois = [m for m, _ in lignes]
    valeurs = np.array([n for _, n in lignes])
    mediane = float(np.median(valeurs))
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.bar(mois, valeurs, color="#1f4e79")
    ax.axhline(mediane, color="#b5532b", linestyle=":", linewidth=1.5, label=f"médiane : {mediane:.0f}")
    ax.set_title("Clients facturés par mois", fontsize=12, fontweight="bold")
    ax.set_ylabel("Clients facturés")
    ax.tick_params(axis="x", rotation=60, labelsize=8)
    ax.legend(frameon=False)
    for cote in ("top", "right"):
        ax.spines[cote].set_visible(False)
    SORTIE.mkdir(parents=True, exist_ok=True)
    fig.savefig(SORTIE / "clients_par_mois_demo.png", dpi=150, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    main()
