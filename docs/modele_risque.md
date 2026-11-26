# Modèle de risque : départ de clients à 3 mois

Généré à partir de `src/modele_risque.py`, sur le jeu de démonstration (données pseudonymisées et déformées : les chiffres ci-dessous sont illustratifs). Aucune donnée client ni aucun montant n'apparaît ici.

## Définition
- **Client récurrent** à la date T : facturé dans au moins 4 des 6 derniers mois.
- **Départ** : aucune facture pendant les 3 mois qui suivent T.
- Les variables sont calculées uniquement avec les mois jusqu'à T. L'étiquette est mesurée après T.
- Le dernier mois n'est pas utilisé pour l'étiquette, car il est peut-être incomplet.

## Données
| Jeu | Origines T | Observations | Départs | Taux de départ |
|---|---|---|---|---|
| Entraînement | mois 6 à 11 (juin à décembre 2024) | 1 591 | 21 | 1,3 % |
| Test | mois 14 à 16 (mars à mai 2025) | 790 | 47 | 5,9 % |

Les origines des mois 12 et 13 sont écartées pour que l'étiquette de l'entraînement ne recouvre pas la période de test.

## Résultats sur le jeu de test
| Modèle | AUC (IC 95 %) | Précision moyenne | Départs détectés dans le top 10 % | CA des départs détecté |
|---|---|---|---|---|
| Règle simple (mois sans facture) | 0,60 (0,55 à 0,65) | 0,20 | 23 % | 74 % |
| Arbre de décision (profondeur 2) | 0,81 (0,74 à 0,85) | 0,17 | 17 % | 45 % |
| Forêt aléatoire | 0,84 (0,79 à 0,88) | 0,26 | 28 % | 55 % |

## Lecture
- Sur l'ensemble du classement, l'arbre est nettement meilleur que la règle simple (AUC 0,81 contre 0,60).
- En tête de liste, il ne l'est pas : dans le top 10 % des clients signalés, 10 % partent réellement contre 14 % avec la règle simple, soit 1,7 fois le taux moyen de 5,9 %.
- La forêt aléatoire est meilleure sur tous les critères, mais elle n'est pas lisible : l'arbre reste le modèle retenu pour son explicabilité.
- Les variables les plus utilisées par l'arbre : le nombre de factures sur 3 mois et le CA du mois comparé à la moyenne des 6 derniers mois.

## Limites
- **Très peu de départs à l'entraînement** (21) : le modèle est fragile. Sur quatre tirages différents de l'anonymisation, l'AUC de l'arbre va de 0,57 à 0,81.
- **Décalage de période** : le taux de départ passe de 1,3 % à 5,9 % entre l'entraînement et le test, à cause des départs observés depuis juin 2025. Le modèle apprend sur une période calme et est testé sur une période agitée.
- **Variables limitées à l'historique de facturation** : les impayés, les opportunités et les tickets n'ont qu'une photo, ou aucun lien client, et ne peuvent pas servir à l'entraînement.
- **Définition du départ** : une absence de facture peut aussi venir d'un changement de rythme de facturation. À confirmer avec la direction financière.
