import numpy as np
import pandas as pd


def mensuel_synthetique(clients: int = 260, mois: int = 20, graine: int = 11) -> pd.DataFrame:
    hasard = np.random.default_rng(graine)
    lignes = []
    for client in range(1, clients + 1):
        profil = hasard.choice(["regulier", "irregulier", "partant"], p=[0.6, 0.2, 0.2])
        taille = float(hasard.lognormal(8.5, 1.0))
        arret = int(hasard.integers(7, mois)) if profil == "partant" and hasard.random() < 0.7 else mois + 1
        for m in range(1, mois + 1):
            if m >= arret:
                continue
            probabilite = 0.62 if profil == "irregulier" else 0.96
            if hasard.random() > probabilite:
                continue
            facteur = 1.0
            if profil == "partant" and arret <= mois:
                facteur = min(1.0, max(0.1, (arret - m) / 6))
            montant = taille * facteur * float(hasard.lognormal(0, 0.2))
            lignes.append((client, 202501 + (m - 1) % 12 + 100 * ((m - 1) // 12), montant, int(hasard.integers(1, 5)), "Groupe" if client % 3 == 0 else "Hors groupe"))
    return pd.DataFrame(lignes, columns=["tiers_id", "periode", "ca_ht", "nb_factures", "segment"])
