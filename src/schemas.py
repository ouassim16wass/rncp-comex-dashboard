
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

SORTIE = Path(__file__).resolve().parent.parent / "docs" / "figures" / "schemas"
COULEURS = {
    "src": ("#f0eaf7", "#6a4c93"),
    "ing": ("#fbede2", "#a4561b"),
    "trt": ("#e8f0f8", "#1f4e79"),
    "sto": ("#e9f3e8", "#2c6a3a"),
    "res": ("#f8e9f0", "#8a2f55"),
    "trv": ("#eceff1", "#4d5560"),
    "fait": ("#e8f0f8", "#1f4e79"),
    "dim": ("#e9f3e8", "#2c6a3a"),
    "ref": ("#faf3e0", "#7a5a14"),
}


def boite(ax, x, y, w, h, titre, sous="", famille="trt", pointille=False, taille=11):
    fond, bord = COULEURS[famille]
    ax.add_patch(
        FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle="round,pad=0.01,rounding_size=0.12",
            fc=fond,
            ec=bord,
            lw=1.6,
            ls="--" if pointille else "-",
            zorder=3,
        )
    )
    ax.text(
        x + w / 2,
        y + h / 2 + (0.12 if sous else 0),
        titre,
        ha="center",
        va="center",
        fontsize=taille,
        fontweight="bold",
        zorder=4,
    )
    if sous:
        ax.text(
            x + w / 2, y + h / 2 - 0.22, sous, ha="center", va="center", fontsize=taille - 3, color="#444", zorder=4
        )


def fleche(ax, p1, p2, texte="", style="-", rad=0.0):
    ax.add_patch(
        FancyArrowPatch(
            p1,
            p2,
            arrowstyle="-|>",
            mutation_scale=14,
            lw=1.5,
            color="#6b7682",
            ls=style,
            connectionstyle=f"arc3,rad={rad}",
            zorder=2,
        )
    )
    if texte:
        ax.text(
            (p1[0] + p2[0]) / 2,
            (p1[1] + p2[1]) / 2 + 0.18,
            texte,
            ha="center",
            fontsize=8.5,
            color="#444",
            bbox=dict(fc="white", ec="none", pad=1),
            zorder=5,
        )


def toile(w, h, titre):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, w)
    ax.set_ylim(0, h)
    ax.axis("off")
    ax.set_title(titre, fontsize=14, fontweight="bold", pad=10)
    return fig, ax


def architecture():
    fig, ax = toile(16, 8.2, "Architecture de la solution")
    for x, n in [(0.3, "SOURCES"), (3.5, "INGESTION"), (6.9, "TRAITEMENT"), (10.0, "STOCKAGE"), (13.0, "RESTITUTION")]:
        ax.text(x, 7.55, n, fontsize=9.5, fontweight="bold", color="#666")
    boite(ax, 0.3, 5.6, 2.6, 1.2, "Sage", "CA, marge, échéances", "src")
    boite(ax, 0.3, 3.9, 2.6, 1.2, "Salesforce", "opportunités", "src")
    boite(ax, 0.3, 2.2, 2.6, 1.2, "iTop", "tickets", "src")
    boite(ax, 3.5, 6.0, 2.8, 1.1, "Dépôt brut", "fichiers datés, intacts", "ing")
    boite(ax, 3.5, 3.7, 2.8, 1.5, "Connecteurs Python", "appels aux API", "ing")
    boite(ax, 3.5, 1.9, 2.8, 1.2, "Kafka", "flux hebdomadaires", "ing")
    boite(ax, 6.9, 2.6, 2.7, 3.6, "PySpark", "contrats, nettoyage,\nrapprochement clients,\npseudonymisation", "trt")
    boite(ax, 10.0, 4.1, 2.5, 2.1, "PostgreSQL", "staging · dwh (flocon)\n· démo", "sto")
    boite(ax, 10.0, 1.9, 2.5, 1.5, "dbt Core", "marts, tests, lignage", "trt")
    boite(ax, 13.0, 6.0, 2.7, 1.1, "Tableau de bord", "Next.js et Bun", "res")
    boite(ax, 13.0, 4.4, 2.7, 1.1, "Modèle de risque", "arbre de décision", "res")
    boite(ax, 13.0, 2.9, 2.7, 1.1, "API de score", "FastAPI", "res")
    boite(ax, 13.0, 1.5, 2.7, 1.1, "Catalogue et docs", "contrats, dbt docs", "res")
    for y in (6.2, 4.5, 2.8):
        fleche(ax, (2.9, y), (3.5, 4.5))
    fleche(ax, (4.9, 5.2), (4.9, 6.0), "lot mensuel")
    fleche(ax, (4.9, 3.7), (4.9, 3.1), "flux hebdo")
    fleche(ax, (6.3, 6.5), (6.9, 5.6))
    fleche(ax, (6.3, 2.5), (6.9, 3.3))
    fleche(ax, (9.6, 4.4), (10.0, 4.9), "chargement")
    fleche(ax, (11.25, 4.1), (11.25, 3.4))
    fleche(ax, (12.5, 5.6), (13.0, 6.4))
    fleche(ax, (12.5, 5.0), (13.0, 4.9))
    fleche(ax, (14.35, 4.4), (14.35, 4.0))
    fleche(ax, (12.5, 2.7), (13.0, 2.0))
    for i, (t, s) in enumerate(
        [
            ("Environnements", "poste local puis interne"),
            ("CI/CD", "GitHub Actions"),
            ("Supervision", "journaux, rapport d'état"),
            ("Sécurité et conformité", "RGPD, AI Act, secrets"),
        ]
    ):
        boite(ax, 0.3 + i * 3.95, 0.15, 3.7, 0.95, t, s, "trv", pointille=True, taille=10)
    fig.savefig(SORTIE / "01_architecture.png", dpi=160, bbox_inches="tight")
    plt.close(fig)


def pipelines():
    fig, ax = toile(16, 7.6, "Les deux chemins d'arrivée des données")
    ax.text(0.3, 6.75, "Lot mensuel : chiffre d'affaires et marge", fontsize=11.5, fontweight="bold", color="#1f4e79")
    ax.text(
        0.3,
        3.45,
        "Flux hebdomadaire : échéances, opportunités, tickets",
        fontsize=11.5,
        fontweight="bold",
        color="#a4561b",
    )
    etapes_h = [
        ("Sage", "API", "src"),
        ("Dépôt brut", "fichier daté", "ing"),
        ("PySpark", "contrat, nettoyage", "trt"),
        ("PostgreSQL", "staging", "sto"),
        ("dbt", "modèle dwh", "trt"),
        ("Marts", "indicateurs", "res"),
    ]
    etapes_b = [
        ("Autres sources", "API Salesforce, iTop, Sage", "src"),
        ("Connecteur", "un message par ligne", "ing"),
        ("Kafka", "un sujet par source", "ing"),
        ("PySpark", "lecture du flux", "trt"),
        ("PostgreSQL", "staging", "sto"),
        ("dbt", "modèle dwh", "trt"),
    ]
    for ligne, etapes, y in ((0, etapes_h, 5.0), (1, etapes_b, 1.7)):
        for i, (t, s, f) in enumerate(etapes):
            boite(ax, 0.3 + i * 2.6, y, 2.2, 1.2, t, s, f, taille=10)
            if i:
                fleche(ax, (0.3 + (i - 1) * 2.6 + 2.2, y + 0.6), (0.3 + i * 2.6, y + 0.6))
    boite(
        ax,
        8.8,
        3.5,
        3.2,
        0.9,
        "Contrat de données",
        "colonnes, types, valeurs, seuil 1 %",
        "ref",
        pointille=True,
        taille=10,
    )
    boite(ax, 12.5, 3.5, 3.2, 0.9, "Quarantaine", "lignes rejetées, comptées", "trv", pointille=True, taille=10)
    fleche(ax, (6.6, 5.0), (9.6, 4.4), "valide")
    fleche(ax, (9.2, 2.9), (10.0, 3.5), "valide")
    fleche(ax, (12.0, 3.95), (12.5, 3.95), "rejet")
    ax.text(
        0.3,
        0.55,
        "Dans les deux chemins : PySpark applique les mêmes contrats, rapproche les clients par la table de correspondance "
        "et ignore les lignes de total en fin d'export.",
        fontsize=9.5,
        color="#444",
    )
    fig.savefig(SORTIE / "02_chemins_arrivee.png", dpi=160, bbox_inches="tight")
    plt.close(fig)


def flocon():
    fig, ax = toile(17, 12.6, "Modèle en flocon de l'entrepôt : 4 faits et leurs dimensions")
    L, H = 2.6, 0.95
    pos = {
        "dim_trimestre": (0, 0),
        "dim_mois": (0, 1),
        "ref_client_correspondance": (1, 1),
        "dim_type_tiers": (2, 1),
        "dim_segment": (3, 1),
        "dim_domaine": (5, 1),
        "dim_date": (0, 2),
        "dim_mois_facturation": (1, 2),
        "dim_tiers": (2, 2),
        "dim_service": (4, 2),
        "dim_produit": (0, 5),
        "dim_compte": (1, 5),
        "dim_commercial": (2, 5),
        "dim_statut_opportunite": (4, 5),
        "dim_famille_produit": (0, 6),
        "dim_classe_compte": (1, 6),
        "dim_etape": (4, 6),
        "dim_motif_cloture": (5, 6),
    }
    grains = {
        "fait_facturation": "une ligne de facture",
        "fait_marge": "une écriture comptable",
        "fait_echeance": "une pièce ouverte à une date de photo",
        "fait_opportunite": "une opportunité à une date de photo",
        "dim_trimestre": "trimestre",
        "dim_mois": "mois civil",
        "dim_date": "jour",
        "dim_mois_facturation": "mois de facturation",
        "dim_tiers": "client ou fournisseur",
        "dim_type_tiers": "type de tiers",
        "dim_segment": "segment de clientèle",
        "dim_service": "code de service",
        "dim_domaine": "domaine D1 à D4",
        "dim_commercial": "un commercial",
        "dim_produit": "un article",
        "dim_famille_produit": "famille d'articles",
        "dim_compte": "compte général",
        "dim_classe_compte": "classe de compte",
        "dim_statut_opportunite": "étape, motif, type",
        "dim_etape": "étape",
        "dim_motif_cloture": "motif de clôture",
        "ref_client_correspondance": "un tiers, trois identifiants",
    }
    xy = {}
    for n, (c, r) in pos.items():
        x, y = 0.3 + c * 2.78, (11.3 - r * 1.5) if r < 3 else (3.7 - (r - 5) * 1.5)
        xy[n] = (x, y)
        fam = "ref" if n.startswith("ref") else "dim"
        boite(ax, x, y, L, H, n, "grain : " + grains[n], fam, pointille=n.startswith("ref"), taille=9.5)
    faits = ["fait_facturation", "fait_marge", "fait_echeance", "fait_opportunite"]
    for i, n in enumerate(faits):
        x, y = 0.9 + i * 4.05, 6.0
        xy[n] = (x, y)
        boite(ax, x, y, 3.5, 1.1, n, "grain : " + grains[n], "fait", taille=10.5)
    liens = [
        ("fait_facturation", d)
        for d in (
            "dim_date",
            "dim_mois_facturation",
            "dim_tiers",
            "dim_service",
            "dim_produit",
            "dim_commercial",
            "dim_compte",
        )
    ]
    liens += [("fait_marge", d) for d in ("dim_date", "dim_tiers", "dim_domaine", "dim_compte")]
    liens += [("fait_echeance", d) for d in ("dim_date", "dim_tiers")]
    liens += [
        ("fait_opportunite", d)
        for d in ("dim_date", "dim_tiers", "dim_commercial", "dim_domaine", "dim_statut_opportunite")
    ]
    liens += [
        ("dim_date", "dim_mois"),
        ("dim_mois", "dim_trimestre"),
        ("dim_tiers", "dim_type_tiers"),
        ("dim_tiers", "dim_segment"),
        ("dim_service", "dim_domaine"),
        ("dim_produit", "dim_famille_produit"),
        ("dim_compte", "dim_classe_compte"),
        ("dim_statut_opportunite", "dim_etape"),
        ("dim_statut_opportunite", "dim_motif_cloture"),
        ("ref_client_correspondance", "dim_tiers"),
    ]
    for a, b in liens:
        (xa, ya), (xb, yb) = xy[a], xy[b]
        wa = 3.5 if a.startswith("fait") else L
        wb = 3.5 if b.startswith("fait") else L
        ca, cb = (xa + wa / 2, ya + (H if a.startswith("fait") else H) / 2), (xb + wb / 2, yb + H / 2)
        haut = cb[1] > ca[1]
        p1 = (ca[0], ya + (1.1 if a.startswith("fait") and haut else (H if haut else 0)))
        p2 = (cb[0], yb + (0 if haut else H))
        ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle="-|>", mutation_scale=9, lw=0.9, color="#8d99a5", zorder=1))
    fig.savefig(SORTIE / "03_modele_flocon.png", dpi=160, bbox_inches="tight")
    plt.close(fig)


def conteneurisation():
    fig, ax = toile(17, 10, "Conteneurisation de la solution")
    ax.add_patch(FancyBboxPatch((0.4, 3.2), 9.6, 6.0, boxstyle="round,pad=0.01,rounding_size=0.15", fc="#fafbfc", ec="#4d5560", lw=1.4, ls="--", zorder=1))
    ax.text(0.7, 8.9, "Docker Compose : poste local (réseau interne unique)", fontsize=11, fontweight="bold", color="#4d5560")
    boite(ax, 0.6, 7.0, 2.1, 1.4, "api", "API de test  :8110", "src")
    boite(ax, 2.95, 7.0, 2.1, 1.4, "kafka", "topics brut.*  :9094", "ing")
    boite(ax, 5.3, 7.0, 2.1, 1.4, "spark", "jobs PySpark", "trt")
    boite(ax, 7.65, 7.0, 2.1, 1.4, "postgres", "entrepôt  :5442", "sto")
    boite(ax, 2.95, 5.1, 2.1, 1.4, "web", "Next.js + Bun  :3100", "res")
    boite(ax, 5.3, 5.1, 2.1, 1.4, "passerelle", "Kong / Otoroshi  :8000", "trv", taille=10)
    boite(ax, 7.65, 5.1, 2.1, 1.4, "score", "FastAPI  :8120", "trt")
    boite(ax, 2.95, 3.5, 2.1, 1.1, "prometheus", "métriques  :9090", "trv", taille=10)
    boite(ax, 5.3, 3.5, 2.1, 1.1, "grafana", "tableaux  :3000", "trv", taille=10)
    fleche(ax, (2.7, 7.7), (2.95, 7.7), "")
    fleche(ax, (5.05, 7.7), (5.3, 7.7), "")
    fleche(ax, (7.4, 7.7), (7.65, 7.7), "")
    fleche(ax, (8.7, 6.55), (8.7, 6.95), "")
    fleche(ax, (7.4, 5.8), (7.65, 5.8), "")
    fleche(ax, (5.05, 5.8), (5.3, 5.8), "")
    fleche(ax, (5.05, 3.9), (5.3, 3.9), "")
    ax.text(0.6, 5.9, "navigateur", fontsize=9, color="#444")
    ax.text(0.6, 5.55, "du COMEX", fontsize=9, color="#444")
    fleche(ax, (1.7, 5.8), (2.95, 5.8), "")
    ax.text(7.65, 4.3, "collecte les métriques\nde tous les services", fontsize=8.5, color="#444", va="top")
    ax.text(0.4, 2.65, "Volumes : pgdata, kafkadata  |  ./data (dépôt brut, quarantaine)  |  donnees_confidentielles (lecture seule)", fontsize=9, color="#444")
    ax.text(0.4, 2.2, "Images : Dockerfile.api, Dockerfile.spark, Dockerfile.web, Dockerfile.score, chacune construite une seule fois", fontsize=9, color="#444")
    ax.text(0.4, 1.3, "Flux : les connecteurs interrogent l'API et publient dans Kafka, Spark lit Kafka et écrit dans PostgreSQL", fontsize=9, color="#444")
    ax.text(0.4, 1.75, "Configuration : variables d'environnement (.env local, secrets Kubernetes ensuite), aucune donnée dans les images", fontsize=9, color="#444")
    ax.text(10.9, 9.0, "Mêmes images, trois environnements", fontsize=11, fontweight="bold", color="#4d5560")
    boite(ax, 10.9, 7.3, 5.6, 1.3, "Registre d'images", "construites par la CI/CD", "ing")
    boite(ax, 10.9, 5.5, 5.6, 1.3, "kind (Kubernetes local)", "Deployments, StatefulSet, CronJob Spark", "trt")
    boite(ax, 10.9, 3.7, 5.6, 1.3, "Entreprise (interne)", "Kafka, Spark, passerelle, dashboard", "sto")
    boite(ax, 10.9, 1.9, 5.6, 1.3, "Clever Cloud (France)", "PostgreSQL managé, applications Docker", "res")
    fleche(ax, (13.7, 7.25), (13.7, 6.85))
    fleche(ax, (13.7, 5.45), (13.7, 5.05))
    fleche(ax, (13.7, 3.65), (13.7, 3.25))
    ax.text(10.9, 1.2, "Kafka n'est jamais déployé sur Clever Cloud", fontsize=9, color="#444")
    fig.savefig(SORTIE / "04_conteneurisation.png", dpi=160, bbox_inches="tight")
    plt.close(fig)


def cicd():
    fig, ax = toile(17, 7.4, "Chaîne CI/CD (GitHub Actions)")
    ax.text(0.4, 6.7, "Intégration continue : à chaque push et chaque demande de fusion", fontsize=11, fontweight="bold", color="#4d5560")
    etapes = [
        ("Push", "branche, PR", "src"),
        ("Qualité", "ruff", "trt"),
        ("Tests", "pytest", "trt"),
        ("Données", "aucun fichier\nconfidentiel suivi", "res"),
        ("Sécurité", "pip-audit", "trt"),
        ("Images", "docker build\n5 images", "ing"),
    ]
    x = 0.4
    for i, (t, sous, fam) in enumerate(etapes):
        boite(ax, x, 4.8, 2.4, 1.4, t, sous, fam)
        if i:
            fleche(ax, (x - 0.35, 5.5), (x, 5.5))
        x += 2.75
    ax.text(0.4, 4.1, "Déploiement continu : après une CI réussie sur la branche principale", fontsize=11, fontweight="bold", color="#4d5560")
    cd = [
        ("Version", "identifiant\ndu commit", "src"),
        ("Publier", "5 images dans\nle registre GHCR", "sto"),
        ("kind", "déploiement\ndans un cluster", "trt"),
        ("Contrôles", "santé, accès\nrefusés sans clé", "res"),
        ("Clever Cloud", "sur demande\nmanuelle", "sto"),
    ]
    x = 0.4
    for i, (t, sous, fam) in enumerate(cd):
        boite(ax, x, 2.2, 2.4, 1.4, t, sous, fam)
        if i:
            fleche(ax, (x - 0.35, 2.9), (x, 2.9))
        x += 2.75
    ax.text(0.4, 1.3, "Garde-fous locaux : hooks git qui refusent les fichiers de données et les messages de commit contenant des traces d'outils d'IA", fontsize=9, color="#444")
    ax.text(0.4, 0.8, "Secrets : stockés dans GitHub Secrets puis dans les secrets Kubernetes, jamais dans le dépôt", fontsize=9, color="#444")
    fig.savefig(SORTIE / "05_cicd.png", dpi=160, bbox_inches="tight")
    plt.close(fig)


def lignage_dbt():
    fig, ax = toile(17, 9.2, "Lignage dbt : de l'entrepôt aux tables lues par le dashboard")
    colonnes = [
        (0.4, "Sources (dwh)", "sto", ["fait_facturation", "fait_marge", "fait_echeance", "fait_opportunite", "dim_* (17 tables)", "stg_tickets (PySpark)"]),
        (4.4, "staging · 21 vues", "src", ["stg_fait_facturation", "stg_fait_marge", "stg_fait_echeance", "stg_fait_opportunite", "stg_dim_tiers, stg_dim_service…", "(une vue par table)"]),
        (8.4, "intermediate · 4 vues", "trt", ["int_facturation", "int_marge", "int_echeances", "int_opportunites", "jointures partagées", "(client, segment, domaine…)"]),
        (12.4, "marts · 12 tables", "res", ["mart_ca_mensuel, mart_client_mensuel", "mart_marge_mensuelle, mart_impayes", "mart_pipeline, mart_win_ratio", "mart_sante_financiere", "cube_facturation, cube_marge", "cube_echeances, cube_pipeline, cube_tickets"]),
    ]
    for x, titre, famille, lignes in colonnes:
        ax.add_patch(FancyBboxPatch((x, 1.6), 3.6, 6.6, boxstyle="round,pad=0.01,rounding_size=0.15", fc="#fafbfc", ec="#cddeef", lw=1.4, zorder=1))
        ax.text(x + 1.8, 7.8, titre, ha="center", fontsize=11, fontweight="bold", color="#141c52")
        for i, ligne in enumerate(lignes):
            boite(ax, x + 0.2, 6.55 - i * 0.98, 3.2, 0.72, ligne, "", famille, taille=7.3 if famille == "res" else 8.5)
    for x in (4.0, 8.0, 12.0):
        fleche(ax, (x - 0.05, 4.9), (x + 0.4, 4.9))
    ax.text(0.4, 1.05, "Tests : 97 contrôles (clés uniques, liens entre faits et dimensions, valeurs autorisées, et 6 tests métier qui comparent les marts et les cubes aux faits).", fontsize=9.5, color="#444")
    ax.text(0.4, 0.55, "Les cubes gardent le grain fin (ligne de facture, écriture, pièce, opportunité) pour permettre d'agréger sur n'importe quel axe.", fontsize=9.5, color="#444")
    fig.savefig(SORTIE / "06_lignage_dbt.png", dpi=160, bbox_inches="tight")
    plt.close(fig)


def chaine_controle():
    fig, ax = toile(17, 5.8, "Chaîne de contrôle des montants")
    etapes = [
        ("Extraction", "somme avant validation", "src"),
        ("Staging", "somme après validation", "ing"),
        ("Entrepôt", "somme des faits chargés", "sto"),
        ("Tables du dashboard", "somme des cubes dbt", "res"),
    ]
    x = 0.5
    for i, (t, sous, fam) in enumerate(etapes):
        boite(ax, x, 2.9, 3.4, 1.7, t, sous, fam, taille=12)
        if i:
            fleche(ax, (x - 0.5, 3.75), (x, 3.75))
        x += 4.1
    ax.text(5.0, 2.45, "écart = montant rejeté", fontsize=9.5, ha="center", color="#444")
    ax.text(9.1, 2.45, "écart attendu : 0,00 €", fontsize=9.5, ha="center", color="#2f7d00")
    ax.text(13.2, 2.45, "écart attendu : 0,00 €", fontsize=9.5, ha="center", color="#2f7d00")
    ax.text(0.5, 1.4, "Chaque chargement enregistre les trois premières sommes dans supervision.execution. Le dashboard recalcule la quatrième et affiche le résultat.", fontsize=9.5, color="#444")
    ax.text(0.5, 0.8, "Un écart supérieur à 5 centimes est signalé en rouge dans la page « Fiabilité des données ».", fontsize=9.5, color="#444")
    fig.savefig(SORTIE / "07_chaine_controle.png", dpi=160, bbox_inches="tight")
    plt.close(fig)


def mlops_observabilite():
    fig, ax = toile(17, 9.6, "Cycle de vie du modèle et observabilité")
    ax.text(0.4, 9.15, "Cycle de vie du modèle de risque", fontsize=11, fontweight="bold", color="#4d5560")
    haut = [
        (0.4, "Historique de facturation", "marts dbt", "sto"),
        (3.6, "Entraînement", "arbre, règle, forêt", "trt"),
        (6.8, "Évaluation", "découpage dans le temps", "trt"),
        (10.0, "Porte qualité", "AUC, départs, régression", "res"),
        (13.2, "Registre", "version, commit, empreinte", "ing"),
    ]
    for i, (x, t, sous, fam) in enumerate(haut):
        boite(ax, x, 7.3, 3.0, 1.5, t, sous, fam, taille=10.5)
        if i:
            fleche(ax, (x - 0.2, 8.05), (x, 8.05))
    boite(ax, 13.2, 5.0, 3.0, 1.5, "API de score", "charge la production", "trt", taille=10.5)
    fleche(ax, (14.7, 7.3), (14.7, 6.55), "promotion")
    boite(ax, 8.8, 5.0, 3.4, 1.5, "Surveillance", "dérive (PSI), performance réalisée", "trt", taille=10.5)
    fleche(ax, (12.2, 5.75), (13.2, 5.75), "score")
    fleche(ax, (9.6, 6.55), (5.4, 7.28), "alerte, réentraînement", rad=-0.25)
    ax.text(0.4, 4.7, "Observabilité", fontsize=11, fontweight="bold", color="#4d5560")
    boite(ax, 13.0, 1.2, 3.4, 2.4, "Grafana", "pipeline · API et modèle · journaux", "res", taille=12)
    lignes = [
        (3.4, [("Journaux JSON", "chaque service, sortie standard", "src"), ("Promtail", "collecte des conteneurs", "ing"), ("Loki", "stockage des journaux", "ing")]),
        (2.1, [("Points /metrics", "requêtes, latence, dérive", "src"), ("Prometheus", "collecte et alertes", "ing")]),
        (0.8, [("Tables de supervision", "chargements, rejets, montants", "sto")]),
    ]
    for y, boites in lignes:
        x = 0.4
        for k, (t, sous, fam) in enumerate(boites):
            boite(ax, x, y, 3.3, 1.0, t, sous, fam, taille=10)
            if k:
                fleche(ax, (x - 0.3, y + 0.5), (x, y + 0.5))
            x += 3.7
    fleche(ax, (11.3, 3.9), (13.0, 3.0))
    fleche(ax, (7.7, 2.6), (13.0, 2.4))
    fleche(ax, (3.9, 1.3), (13.0, 1.8))
    ax.text(0.4, 0.15, "Alertes Prometheus : service injoignable, erreurs, latence, dérive du modèle.", fontsize=9.5, color="#444")
    fig.savefig(SORTIE / "08_mlops_observabilite.png", dpi=160, bbox_inches="tight")
    plt.close(fig)


def main():
    SORTIE.mkdir(parents=True, exist_ok=True)
    architecture()
    pipelines()
    flocon()
    conteneurisation()
    cicd()
    lignage_dbt()
    chaine_controle()
    mlops_observabilite()
    print("Schémas écrits dans", SORTIE)


if __name__ == "__main__":
    main()
