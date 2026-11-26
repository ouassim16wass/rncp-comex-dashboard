# Pilotage de la performance pour le COMEX d'une entreprise

Projet fil rouge du titre RNCP42655 (Data engineer), réalisé par Ouassim Megrad.

**Problématique.** Comment donner à la direction générale une vision unique, fiable et traçable de la performance (finance, commercial, opérations), alors que les chiffres sont aujourd'hui extraits à la main de plusieurs outils et assemblés dans Excel ?

**Réponse.** Une chaîne de données contrôlée de bout en bout : API (Sage, Salesforce, iTop), Kafka, PySpark, PostgreSQL en flocon, dbt, un modèle de risque client versionné et surveillé, et un tableau de bord Next.js. Chaque chargement est rapproché au centime des extractions, et chaque indicateur affiche sa définition et sa source. Les API de Sage, Salesforce et iTop sont internes à l'entreprise et accessibles uniquement depuis son système d'information : le développement et la démonstration utilisent une API interne de test, au même format de réponses.

## Confidentialité

**Les vraies données ne sont jamais dans ce dépôt.** Les extractions (Excel, CSV, Parquet), le dépôt brut, la quarantaine, le fichier `.env` et les modèles entraînés sont exclus par `.gitignore`, par des hooks git locaux et par un contrôle de la CI. Ce qui est versionné est du code, des contrats de données (descriptions de colonnes, sans valeurs), des schémas et des résultats agrégés. Le jeu de démonstration est pseudonymisé (noms et codes remplacés par des empreintes salées, montants multipliés par un coefficient secret) ; un test vérifie qu'il ne contient aucun code réel.

## Architecture

```
API internes Sage / Salesforce / iTop ─► connecteurs ─► dépôt brut ─┬─► Kafka (flux hebdomadaires) ─┐
                                                           └───────────────────────────────┴─► PySpark
PySpark (contrats, quarantaine, pseudonymisation) ─► PostgreSQL (staging, dwh en flocon, supervision)
PostgreSQL ─► dbt (staging, intermediate, marts et cubes) ─► tableau de bord Next.js + API de score
Observabilité : journaux JSON ─► Loki, métriques ─► Prometheus, tableaux ─► Grafana
```

## Démarrage local

Prérequis : Docker, Bun, Python 3.13. Les extractions réelles ne sont pas fournies ; les services se lancent sur le jeu de démonstration.

```
cp .env.example .env            # puis renseigner les valeurs
docker compose up -d            # postgres, kafka, api, score, web
docker compose --profile observabilite up -d      # prometheus, loki, promtail, grafana
docker compose --profile traitement run --rm spark python src/pyspark_ca.py
docker compose --profile traitement run --rm dbt build
python src/modele_risque.py     # entraîne, évalue, enregistre, applique la porte qualité
python src/surveillance_modele.py
```

Ports (tous limités à 127.0.0.1) : tableau de bord 3100, API de score 8120, API interne de test 8110, PostgreSQL 5442, Kafka 9094, Grafana 3200, Prometheus 9190.

## Structure

| Dossier | Rôle |
|---|---|
| `src/` | connecteurs, API interne de test, publication Kafka, jobs PySpark, modèle de risque, registre, surveillance, API de score |
| `data/` | contrats de données (YAML) ; dépôt brut et quarantaine exclus de git |
| `db/` | scripts SQL de l'entrepôt |
| `dbt/` | projet dbt : staging, intermediate, marts, cubes, tests |
| `web/` | tableau de bord Next.js, Bun, Apache ECharts |
| `observabilite/` | configuration Prometheus, Loki, Promtail, Grafana et générateur de tableaux |
| `k8s/` | tâches planifiées d'entraînement et de surveillance du modèle |
| `tests/` | tests Python |
| `docs/` | catalogue de données, conformité, exploration, schémas, MLOps |
| `.github/workflows/` | CI (qualité, données, sécurité, dashboard, images) et CI du modèle (MLOps) |

## Contrôles automatiques

| Ensemble | Nombre | Portée |
|---|---|---|
| dbt | 97 | clés, liens entre faits et dimensions, valeurs autorisées, cohérence des cubes avec les faits |
| pytest | 33 | API interne de test, connecteurs, Kafka, registre de modèles, dérive, journalisation, métriques, pseudonymisation |
| bun test | 35 | règles d'alerte, fenêtres de comparaison, classification des clients, construction sécurisée des requêtes |

## Documentation

- `docs/mlops.md` : cycle de vie du modèle, registre, porte qualité, surveillance, CI/CD.
- `docs/catalogue_donnees.md` : sens de chaque colonne de l'entrepôt et origine.
- `docs/conformite.md` : RGPD, AI Act, secret des affaires.
