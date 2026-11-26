import json
from pathlib import Path

SORTIE = Path(__file__).resolve().parent / "grafana" / "tableaux"
PROM = {"type": "prometheus", "uid": "prometheus"}
LOKI = {"type": "loki", "uid": "loki"}
PG = {"type": "grafana-postgresql-datasource", "uid": "supervision"}


def position(x, y, w, h):
    return {"x": x, "y": y, "w": w, "h": h}


def sql(source, requete, format_="table"):
    return {"datasource": source, "refId": "A", "rawQuery": True, "editorMode": "code", "format": format_, "rawSql": requete}


def prom(expression, legende="", ref="A"):
    return {"datasource": PROM, "refId": ref, "expr": expression, "legendFormat": legende}


def loki(expression):
    return {"datasource": LOKI, "refId": "A", "expr": expression}


def panneau(identifiant, titre, type_, cible, pos, options=None, defauts=None, description=""):
    return {
        "id": identifiant,
        "title": titre,
        "description": description,
        "type": type_,
        "datasource": cible[0]["datasource"],
        "targets": cible,
        "gridPos": position(*pos),
        "options": options or {},
        "fieldConfig": {"defaults": defauts or {}, "overrides": []},
    }


def tableau(uid, titre, panneaux, variables=None):
    return {
        "uid": uid,
        "title": titre,
        "schemaVersion": 39,
        "version": 1,
        "editable": False,
        "refresh": "30s",
        "time": {"from": "now-24h", "to": "now"},
        "timezone": "browser",
        "tags": ["entreprise"],
        "templating": {"list": variables or []},
        "panels": panneaux,
    }


def pipeline():
    seuils_rejet = {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "orange", "value": 0.005}, {"color": "red", "value": 0.01}]}
    panneaux = [
        panneau(
            1,
            "Dernier chargement de chaque source",
            "table",
            [
                sql(
                    PG,
                    "SELECT DISTINCT ON (etape) etape AS \"Étape\", source AS \"Source\", to_char(debut, 'YYYY-MM-DD HH24:MI') AS \"Date\", "
                    "statut AS \"Statut\", lignes_lues AS \"Lues\", lignes_chargees AS \"Chargées\", lignes_rejetees AS \"Rejetées\", "
                    "taux_rejet AS \"Taux de rejet\", duree_s AS \"Durée (s)\" FROM supervision.execution ORDER BY etape, execution_id DESC",
                )
            ],
            (0, 0, 24, 8),
            defauts={"custom": {"align": "auto"}},
            description="Une ligne par chargement : la dernière exécution de chaque job PySpark.",
        ),
        panneau(
            2,
            "Taux de rejet par exécution",
            "timeseries",
            [sql(PG, "SELECT debut AS time, etape AS metric, taux_rejet AS value FROM supervision.execution WHERE $__timeFilter(debut) ORDER BY 1", "time_series")],
            (0, 8, 12, 8),
            defauts={"unit": "percentunit", "max": 0.02, "min": 0, "thresholds": seuils_rejet, "custom": {"thresholdsStyle": {"mode": "line"}}},
            description="Un chargement est refusé au-delà de 1 % de lignes rejetées.",
        ),
        panneau(
            3,
            "Durée des chargements",
            "timeseries",
            [sql(PG, "SELECT debut AS time, etape AS metric, duree_s AS value FROM supervision.execution WHERE $__timeFilter(debut) ORDER BY 1", "time_series")],
            (12, 8, 12, 8),
            defauts={"unit": "s"},
        ),
        panneau(
            4,
            "Rapprochement des montants",
            "table",
            [
                sql(
                    PG,
                    "SELECT DISTINCT ON (etape) etape AS \"Étape\", mesure_controlee AS \"Mesure\", somme_brute AS \"Extraction\", "
                    "somme_brute - somme_staging AS \"Rejeté\", somme_staging AS \"Staging\", somme_entrepot AS \"Entrepôt\", "
                    "round(somme_staging - somme_entrepot, 2) AS \"Écart entrepôt\" FROM supervision.execution "
                    "WHERE somme_brute IS NOT NULL ORDER BY etape, execution_id DESC",
                )
            ],
            (0, 16, 16, 8),
            description="L'écart entre le staging et l'entrepôt doit valoir 0,00.",
        ),
        panneau(
            5,
            "Chargements en échec (24 h)",
            "stat",
            [sql(PG, "SELECT count(*) AS value FROM supervision.execution WHERE statut = 'echec' AND debut > now() - interval '24 hours'")],
            (16, 16, 4, 4),
            defauts={"thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": 1}]}},
        ),
        panneau(
            6,
            "Lignes rejetées (24 h)",
            "stat",
            [sql(PG, "SELECT coalesce(sum(lignes_rejetees), 0) AS value FROM supervision.execution WHERE debut > now() - interval '24 hours'")],
            (20, 16, 4, 4),
        ),
        panneau(
            7,
            "Journal des traitements",
            "logs",
            [loki('{conteneur=~"spark|dbt"} | json')],
            (0, 24, 24, 9),
            options={"showTime": True, "wrapLogMessage": True, "sortOrder": "Descending"},
        ),
    ]
    return tableau("pipeline-donnees", "Pipeline de données", panneaux)


def modele():
    panneaux = [
        panneau(1, "Modèle en production", "stat", [prom("modele_en_production", "{{version}}")], (0, 0, 6, 4), options={"textMode": "name", "reduceOptions": {"calcs": ["lastNotNull"], "fields": ""}}),
        panneau(
            2,
            "AUC de l'évaluation",
            "stat",
            [prom("modele_auc_evaluation")],
            (6, 0, 4, 4),
            defauts={"decimals": 2, "thresholds": {"mode": "absolute", "steps": [{"color": "red", "value": None}, {"color": "orange", "value": 0.7}, {"color": "green", "value": 0.8}]}},
        ),
        panneau(
            3,
            "Dérive maximale",
            "stat",
            [prom("max(modele_psi)")],
            (10, 0, 4, 4),
            defauts={"decimals": 2, "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "orange", "value": 0.1}, {"color": "red", "value": 0.25}]}},
            description="Indice de stabilité de population : moins de 0,1 stable, de 0,1 à 0,25 à surveiller, au-delà dérive forte.",
        ),
        panneau(
            4,
            "Clients scorés par niveau",
            "bargauge",
            [prom("clients_scores", "{{niveau}}")],
            (14, 0, 10, 4),
            options={"orientation": "horizontal", "displayMode": "gradient"},
        ),
        panneau(
            5,
            "Dérive par variable",
            "bargauge",
            [prom("modele_psi", "{{variable}}")],
            (0, 4, 12, 9),
            options={"orientation": "horizontal", "displayMode": "gradient", "minVizHeight": 14},
            defauts={"min": 0, "max": 1.2, "decimals": 2, "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "orange", "value": 0.1}, {"color": "red", "value": 0.25}]}},
        ),
        panneau(
            6,
            "Requêtes par seconde",
            "timeseries",
            [prom("sum by (route) (rate(requetes_total{service=\"api-score\"}[5m]))", "{{route}}")],
            (12, 4, 12, 9),
            defauts={"unit": "reqps"},
        ),
        panneau(
            7,
            "Latence (95e centile)",
            "timeseries",
            [prom("histogram_quantile(0.95, sum by (le, route) (rate(duree_requete_secondes_bucket{service=\"api-score\"}[5m])))", "{{route}}")],
            (0, 13, 12, 8),
            defauts={"unit": "s"},
        ),
        panneau(
            8,
            "Part d'erreurs",
            "timeseries",
            [prom("sum(rate(requetes_total{service=\"api-score\",code=~\"[45]..\"}[5m])) / sum(rate(requetes_total{service=\"api-score\"}[5m]))", "erreurs")],
            (12, 13, 12, 8),
            defauts={"unit": "percentunit", "min": 0, "max": 1},
        ),
        panneau(
            9,
            "Historique des mesures de surveillance",
            "table",
            [
                sql(
                    PG,
                    "SELECT to_char(date_mesure, 'YYYY-MM-DD') AS \"Date\", version AS \"Version\", indicateur AS \"Indicateur\", valeur AS \"Valeur\", statut AS \"Statut\" "
                    "FROM supervision.modele_surveillance ORDER BY date_mesure DESC, indicateur LIMIT 60",
                )
            ],
            (0, 21, 24, 9),
        ),
    ]
    return tableau("api-modele", "API de score et modèle", panneaux)


def journaux():
    variables = [
        {
            "name": "service",
            "label": "Service",
            "type": "query",
            "datasource": LOKI,
            "query": {"label": "service", "refId": "variable", "type": 1},
            "includeAll": True,
            "allValue": ".+",
            "current": {"text": "Tous", "value": "$__all"},
            "multi": False,
            "refresh": 2,
        },
        {
            "name": "niveau",
            "label": "Niveau",
            "type": "custom",
            "query": "info,warning,error",
            "includeAll": True,
            "allValue": ".+",
            "current": {"text": "Tous", "value": "$__all"},
            "multi": False,
        },
    ]
    panneaux = [
        panneau(
            1,
            "Volume de journaux par niveau",
            "timeseries",
            [{**loki('sum by (niveau) (count_over_time({service=~"$service", niveau=~"$niveau"}[1m]))'), "legendFormat": "{{niveau}}"}],
            (0, 0, 12, 8),
            defauts={"custom": {"drawStyle": "bars", "stacking": {"mode": "normal"}}},
        ),
        panneau(
            2,
            "Erreurs et avertissements",
            "stat",
            [loki('sum(count_over_time({service=~"$service", niveau=~"warning|error"}[$__range]))')],
            (12, 0, 6, 8),
            defauts={"thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "orange", "value": 1}, {"color": "red", "value": 20}]}},
        ),
        panneau(
            3,
            "Événements les plus fréquents",
            "bargauge",
            [{**loki('topk(8, sum by (evenement) (count_over_time({service=~"$service"} | json [$__range])))'), "legendFormat": "{{evenement}}"}],
            (18, 0, 6, 8),
            options={"orientation": "horizontal"},
        ),
        panneau(
            4,
            "Journaux",
            "logs",
            [loki('{service=~"$service", niveau=~"$niveau"}')],
            (0, 8, 24, 16),
            options={"showTime": True, "wrapLogMessage": True, "enableLogDetails": True, "sortOrder": "Descending"},
        ),
    ]
    return tableau("journaux", "Journaux applicatifs", panneaux, variables)


def main():
    SORTIE.mkdir(parents=True, exist_ok=True)
    for nom, contenu in (("pipeline", pipeline()), ("modele", modele()), ("journaux", journaux())):
        (SORTIE / f"{nom}.json").write_text(json.dumps(contenu, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Tableaux Grafana écrits dans", SORTIE)


if __name__ == "__main__":
    main()
