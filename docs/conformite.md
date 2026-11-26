# Conformité : RGPD, AI Act et confidentialité

La conformité est traitée dès la conception (bloc 1), car elle décide de ce qu'on collecte, de ce qu'on montre et de l'endroit où on l'héberge.

## Données concernées et rôle de l'entreprise

Les données viennent des outils internes de l'entreprise : Sage, Salesforce et iTop. L'entreprise en est responsable de traitement : elle décide de leur finalité, qui est de piloter la performance de l'entreprise.

La plupart des données concernent des entreprises (chiffre d'affaires, marge, soldes). Les données personnelles sont peu nombreuses :
- les commerciaux (code commercial, propriétaire d'une opportunité) ;
- les entrepreneurs individuels parmi les clients, qui sont des personnes physiques ;
- les noms qui apparaîtraient dans des textes libres.

Les agents et demandeurs iTop ainsi que les textes libres ne sont pas collectés.

## RGPD : principes appliqués

| Principe | Application dans le projet |
|---|---|
| Minimisation (art. 5) | 57 colonnes retenues sur 115 dans les exports. Les textes libres, les noms d'agents et les colonnes vides sont écartés. |
| Finalité (art. 5) | Chaque contrat de données porte sa finalité. Les données ne servent qu'au pilotage de la performance et au modèle de risque client. |
| Exactitude (art. 5) | Les contrats contrôlent les colonnes, les types et les valeurs. Le seuil de rejet est de 1 %. |
| Limitation de la conservation (art. 5) | Chaque contrat a un champ de conservation. Les durées sont fixées avec le DPO et appliquées par purge. |
| Sécurité (art. 32) | Pseudonymisation, accès en lecture seule pour le COMEX, secrets hors du dépôt, aucun fichier de données versionné. |
| Protection dès la conception (art. 25) | L'anonymisation est prévue avant tout partage hors de l'entreprise. Un schéma de démonstration est séparé du schéma réel. |
| Responsabilité (art. 5.2 et 30) | Registre des traitements et catalogue de données qui note la sensibilité de chaque colonne. |

**Base légale.** L'intérêt légitime de l'entreprise à piloter son activité (art. 6.1.f).

**Analyse d'impact (art. 35).** Elle n'est probablement pas nécessaire : il n'y a pas de profilage de personnes physiques et les données sont surtout professionnelles. La décision appartient au DPO.

## Registre des traitements

| Traitement | Finalité | Données | Personnes concernées | Destinataires et durée |
|---|---|---|---|---|
| Pilotage financier | Suivre CA, marge, créances et dettes | Code et nom du client, montants, code commercial | Commerciaux, contacts de clients entrepreneurs individuels | COMEX, secrétariat général, équipe data. Durée fixée avec le DPO |
| Pipeline commercial | Suivre les opportunités et leur transformation | Compte, propriétaire, montant, étape | Commerciaux | Direction commerciale, COMEX. Durée fixée avec le DPO |
| Suivi des incidents | Mesurer le respect des délais par client | Client, dates, priorité, état, impact | Aucune personne identifiée (agents et demandeurs exclus) | Direction des systèmes d'information, COMEX. Durée fixée avec le DPO |
| Modèle de risque client | Repérer les clients dont le CA risque de baisser | Historique de facturation, tickets, segment | Clients, surtout des personnes morales | Direction commerciale et financière. Décision humaine, pas de décision automatique |
| Jeu de démonstration | Présenter le projet au jury | Données pseudonymisées, montants transformés | Aucune personne identifiable | Jury, lecteurs du mémoire. Conservé le temps de la certification |

## Pseudonymisation et jeu de démonstration

Pseudonymiser, ce n'est pas anonymiser. D'après les [lignes directrices 01/2025 du CEPD](https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2025/guidelines-012025-pseudonymisation_en?page=1), des données pseudonymisées restent des données personnelles tant qu'une information supplémentaire permet de les réidentifier. Dans ce projet, cette information est la table de correspondance. Elle est gardée hors du dépôt, dans un dossier à accès restreint.

Le jeu de démonstration applique cinq règles :
- les noms de clients et de commerciaux deviennent des codes obtenus par une empreinte secrète ;
- les montants sont multipliés par un coefficient secret ;
- une part des clients est retirée au hasard et chaque client reçoit un facteur multiplicatif secret, ce qui modifie les volumes, les croissances et les parts ;
- des facteurs secrets s'appliquent par année et par catégorie, et une partie des tickets et des opportunités est écartée ;
- toutes les dates sont décalées d'une durée secrète, en conservant les mois et les saisons.

Le mémoire parle donc de **données pseudonymisées et déformées**, pas de données anonymes au sens du RGPD. Les chiffres présentés sont illustratifs : ils ne reflètent plus l'activité réelle de l'entreprise.

## AI Act : classification du modèle

Le règlement (UE) 2024/1689 classe les systèmes d'IA par niveau de risque. Le modèle du projet est un arbre de décision qui repère des clients dont le chiffre d'affaires risque de baisser. Il sert en interne, sur des entreprises, comme aide à la décision.

**Classification : risque minimal.** Cet usage ne figure pas parmi les cas à haut risque de l'annexe III (emploi, évaluation de la solvabilité des personnes physiques, services essentiels…). Obligations retenues, par bonne pratique et par l'article 4 :
- **maîtrise de l'IA :** le COMEX est formé à lire un score et ses limites (bloc 4) ;
- **supervision humaine :** le score n'entraîne aucune décision automatique ;
- **fiche du modèle :** données, métriques, limites et versions ;
- **traçabilité :** chaque version du modèle est conservée avec ses résultats.

**Calendrier.** L'omnibus numérique sur l'IA, adopté en 2026, a reporté les obligations des systèmes à haut risque au 2 décembre 2027 pour l'annexe III et au 2 août 2028 pour l'annexe I ([Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes), [Addleshaw Goddard](https://www.addleshawgoddard.com/en/insights/insights-briefings/2026/technology/eu-ai-act-ai-omnibus-formally-adopted/)). Les sources ne donnent pas la même date d'adoption (juillet 2026) : le texte publié au Journal officiel fait foi.

**Lien avec le périmètre.** Un modèle appliqué aux salariés (absentéisme, turnover) relèverait du domaine de l'emploi, donc du haut risque. C'est une raison de plus de garder les ressources humaines hors du périmètre.

## Secret des affaires et sécurité

- Les chiffres présentés hors de l'entreprise sont transformés (voir plus haut).
- Les données réelles restent chez l'entreprise : sur le poste de développement pendant la construction, puis en interne. La production s'appuie sur Clever Cloud, hébergeur français dont la plateforme est certifiée ISO 27001:2022 ([annonce](https://www.clever.cloud/blog/company/2024/03/22/iso27001-clever-cloud/)).
- Aucun fichier de données et aucun secret ne peut être versionné : le `.gitignore` et des contrôles de commit les bloquent.
- Les obligations de sécurité propres à un prestataire d'un groupe réglementé (NIS2, DORA) sont à vérifier avec le responsable de la sécurité.

## Qui valide quoi

| Responsable | Validation |
|---|---|
| DPO | Registre des traitements, durées de conservation, analyse d'impact, publication des ratios |
| Responsable de la sécurité | Hébergement, accès, obligations NIS2 et DORA |
| Direction financière | Définitions des indicateurs de Sage |
| Direction commerciale | Définitions des indicateurs de Salesforce |
