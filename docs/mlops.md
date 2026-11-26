# Cycle de vie du modèle de risque (MLOps)

Le modèle prédit si un client récurrent ne sera plus facturé dans les trois mois. Cette page décrit comment il est entraîné, versionné, contrôlé, déployé et surveillé.

## 1. Entraînement reproductible

`src/modele_risque.py` charge l'historique de facturation par client et par mois (`marts.mart_client_mensuel`), construit les variables avec les seuls mois antérieurs à la date T, mesure l'étiquette sur les trois mois suivants, puis évalue un arbre de décision, une règle simple et une forêt aléatoire par un découpage dans le temps. La graine est fixée : à données égales, le résultat est identique.

## 2. Registre de modèles

Chaque entraînement crée un dossier `models/registre/<version>/` avec le modèle et un fichier `meta.json` : date, commit git, empreinte du jeu d'entraînement, paramètres, métriques d'évaluation, effectifs, distribution de chaque variable (référence de la surveillance) et seuils. `registre.json` désigne la version en production et garde l'historique des décisions. Le dossier est exclu de git : un registre est un artefact d'exploitation, pas du code.

## 3. Porte qualité

Un modèle candidat n'est promu que si toutes ces conditions sont réunies, sinon il est refusé et la production reste inchangée :

- au moins 20 départs observés à l'entraînement ;
- AUC de l'arbre supérieure d'au moins 0,10 à celle de la règle simple ;
- borne basse de l'intervalle de confiance de l'arbre au-dessus de l'AUC de la règle simple ;
- pas de régression de plus de 0,02 d'AUC par rapport au modèle en production.

## 4. Déploiement

L'API de score charge le modèle en production depuis le registre. Elle expose sa version, son commit et ses métriques d'évaluation (`/modele`), l'historique des décisions (`/registre`) et la dernière surveillance (`/surveillance`). Changer de modèle ne demande aucune reconstruction d'image.

## 5. Surveillance

`src/surveillance_modele.py` score les clients actuels et mesure :

- **la dérive de chaque variable** par l'indice de stabilité de population (moins de 0,1 stable, de 0,1 à 0,25 à surveiller, au-delà dérive forte) ;
- la part de clients par niveau de risque ;
- **la performance réalisée** : les scores sont conservés (`supervision.score_historique`) ; trois mois plus tard, on sait qui est réellement parti et l'on calcule l'AUC réelle.

Les mesures vont dans `supervision.modele_surveillance`, dans Prometheus (via l'API de score), dans Grafana et dans la page « Suivi du modèle » du tableau de bord. Une dérive supérieure à 0,25 déclenche l'alerte `DeriveDuModele`.

## 6. Intégration et livraison continues

- **CI du code** (`.github/workflows/ci.yml`) : qualité, absence de données, sécurité, tableau de bord, images.
- **CI du modèle** (`.github/workflows/mlops.yml`) : tests du registre, de la dérive et de la journalisation ; entraînement complet, porte qualité comprise, sur un jeu **synthétique** (les vraies données ne quittent jamais l'entreprise) ; validation de la configuration d'observabilité ; construction de l'image de score.
- **Entraînement continu** : il a lieu dans l'entreprise, là où sont les données. `k8s/modele-cronjobs.yaml` planifie la surveillance quotidienne et l'entraînement mensuel. La promotion est automatique si la porte qualité est franchie, avec trace dans le registre.

## 7. Enseignements

La surveillance et la porte qualité ont déjà servi : la dérive a révélé que la variable « ancienneté observée » n'était qu'une horloge (les données commencent en janvier 2025), qui faussait les scores. Elle a été retirée ; la porte qualité a ensuite refusé le jeu synthétique qui reposait sur elle.
