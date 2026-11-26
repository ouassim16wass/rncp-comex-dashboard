# Catalogue de données de l'entrepôt

Généré par `src/catalogue.py` depuis les contrats de données (`data/`). Il explique chaque colonne de l'entrepôt : son sens, son origine et la règle qui la produit. Il ne contient aucune donnée réelle.

Sensibilité : **interne** (usage de l'entreprise), **confidentiel** (secret des affaires : pseudonymisé ou transformé hors de l'entreprise), **personnel** (identifie une personne : pseudonymisé).

## Les sources

| Contrat | Source | Propriétaire | Grain | Fréquence | Finalité |
|---|---|---|---|---|---|
| itop_tickets | iTop (API REST) | Direction des systèmes d'information (rôle) | Un ticket | Hebdomadaire à terme | Compter les incidents par client et mesurer le respect des délais, comme variables explicatives du risque client. |
| sage_ca_facture | Sage (API) | Direction administrative et financière (rôle) | Une ligne de facture | Mensuelle, vers le 20 du mois | Suivre le chiffre d'affaires facturé par client, domaine et mois pour le tableau de bord de direction. |
| sage_echeances | Sage (API) | Direction administrative et financière (rôle) | Une pièce ouverte à une date de photo | Hebdomadaire à terme, mensuelle aujourd'hui | Suivre les créances clients et les dettes fournisseurs échues pour la trésorerie. |
| sage_marge_brute | Sage (API) | Direction administrative et financière (rôle) | Une écriture comptable | Mensuelle, à l'arrêté comptable (vers le 30) | Calculer la marge brute par domaine et par mois : produits moins charges directes. |
| salesforce_opportunites | Salesforce (API) | Direction commerciale (rôle) | Une opportunité à une date de photo | Hebdomadaire à terme | Suivre le pipeline commercial, le taux de transformation et la préparation du CA futur. |

Conservation et base légale : à valider avec le DPO (voir chaque contrat).

## fait_facturation

Grain : Une ligne de facture.

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `ligne_facture_id` | entier | Identifiant technique de la ligne de facture (clé primaire). | Clé technique générée par l'entrepôt | Aucune | interne |
| `date_facture_id` | entier | Clé vers dim_date (date de la facture). | Sage, contrat sage_ca_facture, colonne « Date facture »<br>Clé technique générée par l'entrepôt | Convertie en identifiant de date (dim_date). | interne |
| `mois_facturation_id` | entier | Clé vers dim_mois_facturation. | Clé technique générée par l'entrepôt | Aucune | interne |
| `tiers_id` | entier | Clé vers dim_tiers (le client). | Clé technique générée par l'entrepôt | Aucune | interne |
| `produit_id` | entier | Clé vers dim_produit (l'article). | Clé technique générée par l'entrepôt | Aucune | interne |
| `service_id` | entier | Clé vers dim_service (le code de service). | Clé technique générée par l'entrepôt | Aucune | interne |
| `commercial_id` | entier | Clé vers dim_commercial. | Clé technique générée par l'entrepôt | Aucune | interne |
| `compte_id` | entier | Clé vers dim_compte. | Clé technique générée par l'entrepôt | Aucune | interne |
| `no_facture` | texte | Numéro de la facture Sage. Une facture compte plusieurs lignes. | Sage, contrat sage_ca_facture, colonne « No facture » | Conservé tel quel. | interne |
| `type_facture` | texte | FAC pour une facture, AVO pour un avoir. | Sage, contrat sage_ca_facture, colonne « Type facture » | Conservé tel quel. | interne |
| `quantite` | décimal | Quantité facturée sur la ligne. | Sage, contrat sage_ca_facture, colonne « Qté facturée » | Conservée telle quelle. | confidentiel |
| `montant_ht` | décimal | Montant hors taxes de la ligne, en euros. Négatif pour un avoir. | Sage, contrat sage_ca_facture, colonne « Montant HT » | Multiplié par un coefficient secret dans le jeu de démonstration. | confidentiel |
| `build_run` | texte | BUILD pour une prestation de construction (projet) ou RUN pour une prestation récurrente d'exploitation. À confirmer avec la DAF. | Sage, contrat sage_ca_facture, colonne « Build/Run » | Conservé tel quel. | interne |

## fait_marge

Grain : Une écriture comptable.

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `ecriture_id` | entier | Identifiant technique de l'écriture comptable (clé primaire). | Clé technique générée par l'entrepôt | Aucune | interne |
| `date_comptable_id` | entier | Clé vers dim_date (date de l'écriture). | Sage, contrat sage_marge_brute, colonne « Date comptable »<br>Clé technique générée par l'entrepôt | Convertie en identifiant de date (dim_date). | interne |
| `compte_id` | entier | Clé vers dim_compte. | Clé technique générée par l'entrepôt | Aucune | interne |
| `domaine_id` | entier | Clé vers dim_domaine ; « non affecté » quand le domaine est vide. | Clé technique générée par l'entrepôt | Aucune | interne |
| `tiers_id` | entier | Clé vers dim_tiers ; renseignée sur un tiers des écritures seulement. | Clé technique générée par l'entrepôt | Aucune | interne |
| `type_piece` | texte | Code Sage du type de pièce comptable (facture, avoir, paiement, opération diverse…). | Sage, contrat sage_marge_brute, colonne « Type de pièce » | Conservé tel quel. | interne |
| `numero_piece` | texte | Numéro de la pièce comptable. | Sage, contrat sage_marge_brute, colonne « Numéro de pièce » | Conservé tel quel. | interne |
| `section_analytique` | entier | Code de la section analytique. Elle détermine le domaine quand celui-ci est renseigné. | Sage, contrat sage_marge_brute, colonne « Section analytique » | Conservée. Elle servira au budget par direction dans une version ultérieure. | interne |
| `build_run` | texte | BUILD, RUN ou PRODUCTION. La valeur PRODUCTION n'existe pas dans le CA facturé : correspondance à confirmer. | Sage, contrat sage_marge_brute, colonne « Build/Run » | Conservé tel quel. | interne |
| `montant_signe` | décimal | Montant de l'écriture, signé : les produits sont en crédit (négatif) et les charges en débit (positif). | Sage, contrat sage_marge_brute, colonne « Montant » | Multiplié par un coefficient secret dans le jeu de démonstration. | confidentiel |

## fait_echeance

Grain : Une pièce ouverte à une date de photo.

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `echeance_id` | entier | Identifiant technique de la pièce ouverte (clé primaire). | Clé technique générée par l'entrepôt | Aucune | interne |
| `date_photo_id` | entier | Clé vers dim_date (date de la photo). | Calculée (sage_echeances)<br>Clé technique générée par l'entrepôt | Fournie au chargement, absente des fichiers. | interne |
| `date_echeance_id` | entier | Clé vers dim_date (date d'échéance). | Sage, contrat sage_echeances (factures clients), colonne « Date Ech. »<br>Sage, contrat sage_echeances (factures fournisseurs), colonne « Echéance »<br>Clé technique générée par l'entrepôt | Convertie en identifiant de date. Sert à calculer le retard.<br>Convertie en identifiant de date. | interne |
| `tiers_id` | entier | Clé vers dim_tiers (client ou fournisseur). | Clé technique générée par l'entrepôt | Aucune | interne |
| `solde` | décimal | Solde restant dû sur la pièce, en euros. Quelques soldes sont négatifs (avoirs ou règlements non affectés). | Sage, contrat sage_echeances (factures clients), colonne « Solde »<br>Sage, contrat sage_echeances (factures fournisseurs), colonne « Solde total » | Multiplié par un coefficient secret dans le jeu de démonstration. | confidentiel |
| `type_piece` | texte | Type de pièce Sage : FAF facture fournisseur, AVF avoir fournisseur, DEC, BQE, OD, ENC. | Sage, contrat sage_echeances (factures fournisseurs), colonne « Colonne1 » | Renommée type_piece. | interne |
| `reference_piece` | texte | Référence de la pièce fournisseur. Absente de l'extraction clients. | Sage, contrat sage_echeances (factures fournisseurs), colonne « Référence » | Conservée telle quelle. | interne |
| `sens` | texte | créance (somme due par un client) ou dette (somme due à un fournisseur). | Calculée (sage_echeances) | créance pour le fichier clients, dette pour le fichier fournisseurs. | interne |
| `jours_retard` | entier | Nombre de jours entre la date d'échéance et la date de photo. Positif ou nul si la pièce est échue. | Calculée (sage_echeances) | date_photo moins date_echeance. | interne |
| `tranche_retard` | texte | Tranche d'ancienneté du retard : non échu, moins de 15 jours, 15 à 30 jours, plus de 30 jours. | Calculée (sage_echeances) | Calculée à partir de jours_retard (les colonnes d'ancienneté des extractions sont ignorées). | interne |

## fait_opportunite

Grain : Une opportunité à une date de photo.

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `opportunite_photo_id` | entier | Identifiant technique de l'opportunité à une date de photo (clé primaire). | Clé technique générée par l'entrepôt | Aucune | interne |
| `date_photo_id` | entier | Clé vers dim_date (date de la photo). | Calculée (salesforce_opportunites)<br>Clé technique générée par l'entrepôt | Extraite de la ligne « Au AAAA-MM-JJ hh:mm:ss ». | interne |
| `tiers_id` | entier | Clé vers dim_tiers (le compte). | Clé technique générée par l'entrepôt | Aucune | interne |
| `commercial_id` | entier | Clé vers dim_commercial. | Clé technique générée par l'entrepôt | Aucune | interne |
| `domaine_id` | entier | Clé vers dim_domaine. | Clé technique générée par l'entrepôt | Aucune | interne |
| `statut_id` | entier | Clé vers dim_statut_opportunite. | Clé technique générée par l'entrepôt | Aucune | interne |
| `montant_global` | décimal | Montant total de l'opportunité, en euros. | Salesforce, contrat salesforce_opportunites, colonne « Montant global » | Multiplié par un coefficient secret dans le jeu de démonstration. | confidentiel |
| `nb_mois` | entier | Durée du contrat en mois. | Salesforce, contrat salesforce_opportunites, colonne « Nombre de mois » | Conservé tel quel. | interne |

## dim_date

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `date_id` | entier | Identifiant du jour, au format AAAAMMJJ. | Calendrier généré par l'entrepôt (une ligne par jour) | Aucune | interne |
| `date` | date | Le jour. | Calendrier généré par l'entrepôt (une ligne par jour) | Aucune | interne |
| `mois_id` | entier | Mois civil auquel appartient le jour (dim_mois). | Calendrier généré par l'entrepôt (une ligne par jour) | Aucune | interne |

## dim_mois

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `mois_id` | entier | Identifiant du mois civil, au format AAAAMM. | Calendrier généré par l'entrepôt | Aucune | interne |
| `mois` | entier | Numéro du mois de 1 à 12. | Calendrier généré par l'entrepôt | Aucune | interne |
| `libelle` | texte | Nom du mois. | Calendrier généré par l'entrepôt | Aucune | interne |
| `trimestre_id` | entier | Trimestre auquel appartient le mois (dim_trimestre). | Calendrier généré par l'entrepôt | Aucune | interne |

## dim_trimestre

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `trimestre_id` | entier | Identifiant du trimestre, au format AAAAT. | Calendrier généré par l'entrepôt | Aucune | interne |
| `trimestre` | entier | Numéro du trimestre de 1 à 4. | Calendrier généré par l'entrepôt | Aucune | interne |
| `annee` | entier | Année civile. | Calendrier généré par l'entrepôt | Aucune | interne |

## dim_mois_facturation

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `mois_sage` | entier | Mois du cycle de facturation. Il ne suit pas le mois civil : il commence autour du 20. Règle exacte à confirmer avec la DAF. | Sage, contrat sage_ca_facture, colonne « Mois »<br>Valeurs de la colonne Mois du CA facturé Sage | Conservé avec la date réelle de la facture pour pouvoir changer de règle. | interne |
| `mois_facturation_id` | entier | Identifiant du mois de facturation. | Valeurs de la colonne Mois du CA facturé Sage | Aucune | interne |
| `annee` | entier | Année du cycle de facturation. | Valeurs de la colonne Mois du CA facturé Sage | Aucune | interne |

## dim_tiers

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `code_sage` | texte | Code du client dans Sage. Clé de jointure avec les factures clients et la marge. | Sage, contrat sage_ca_facture, colonne « Tiers »<br>Sage, contrat sage_echeances (factures clients), colonne « Client »<br>Sage, contrat sage_echeances (factures fournisseurs), colonne « Tiers »<br>Sage, contrat sage_marge_brute, colonne « Tiers Client / Fournisseur » | Remplacé par un identifiant de tiers (dim_tiers), jamais exposé dans le jeu de démonstration.<br>Rattaché à dim_tiers.<br>Rattaché à dim_tiers avec le type fournisseur.<br>Rattaché à dim_tiers par le code Sage. | confidentiel |
| `raison_sociale_pseudo` | texte | Nom du client. | Sage, contrat sage_ca_facture, colonne « Raison sociale »<br>Sage, contrat sage_echeances (factures clients), colonne « Lib. Client »<br>Salesforce, contrat salesforce_opportunites, colonne « Nom du compte » | Pseudonymisé (Client 017) dans le jeu de démonstration.<br>Pseudonymisé dans le jeu de démonstration.<br>Rapproché du code Sage par la table de correspondance, puis pseudonymisé. | confidentiel |
| `tiers_id` | entier | Identifiant unique d'un tiers dans l'entrepôt. | Table de correspondance des clients (Sage, Salesforce, iTop) | Aucune | interne |
| `type_tiers_id` | entier | Rattache le tiers à client ou fournisseur. | Table de correspondance des clients (Sage, Salesforce, iTop) | Aucune | interne |
| `segment_id` | entier | Rattache le tiers à son segment. | Table de correspondance des clients (Sage, Salesforce, iTop) | Aucune | confidentiel |

## dim_type_tiers

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `type_tiers_id` | entier | Identifiant du type de tiers. | Deux valeurs fixes | Aucune | interne |
| `libelle` | texte | client ou fournisseur. | Deux valeurs fixes | Aucune | interne |

## dim_segment

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `libelle` | texte | Appartenance du client au groupe actionnaire : G pour Groupe, HG pour Hors Groupe. | Sage, contrat sage_ca_facture, colonne « G/HG »<br>Sage, contrat sage_echeances (factures clients), colonne « Groupe/HG »<br>Salesforce, contrat salesforce_opportunites, colonne « Groupe Crédit Agricole »<br>Valeurs normalisées des colonnes G/HG, Groupe/HG et la colonne de groupe de Salesforce | G devient Groupe et HG devient Hors groupe (dim_segment).<br>Normalisé en Groupe, Hors groupe, Public, Douteux.<br>Oui devient Groupe, Non devient Hors groupe. Sage reste la référence. | confidentiel |
| `segment_id` | entier | Identifiant du segment. | Valeurs normalisées des colonnes G/HG, Groupe/HG et la colonne de groupe de Salesforce | Aucune | interne |

## dim_service

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `code_service` | entier | Code de service. Il détermine le domaine. Le code 990 correspond au négoce et est exclu du CA facturé. | Sage, contrat sage_ca_facture, colonne « Services » | Rattaché à son domaine (dim_service vers dim_domaine). Les lignes 990 sont chargées mais exclues du calcul du CA. | interne |
| `service_id` | entier | Identifiant du code de service. | Codes de service du CA facturé Sage | Aucune | interne |
| `domaine_id` | entier | Domaine auquel le code de service appartient (vérifié à 100 %). | Codes de service du CA facturé Sage | Aucune | interne |

## dim_domaine

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `domaine` | texte | Domaine d'activité : D1 communication client, D2 dématérialisation, D3 plateformes digitales, D4 solutions de confiance. | Sage, contrat sage_ca_facture, colonne « Domaine »<br>Sage, contrat sage_marge_brute, colonne « Domaine »<br>Salesforce, contrat salesforce_opportunites, colonne « Domaine » | Conservé tel quel.<br>Quand il est vide, l'écriture est rattachée à « non affecté ».<br>Normalisé en D1, D2, D3, D4. | interne |
| `domaine_id` | entier | Identifiant du domaine. | Quatre domaines D1 à D4 | Aucune | interne |

## dim_commercial

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `code_commercial` | entier | Code du commercial responsable de l'affaire. Il identifie indirectement une personne. | Sage, contrat sage_ca_facture, colonne « Code Commercial »<br>Salesforce, contrat salesforce_opportunites, colonne « Propriétaire de l'opportunité » | Pseudonymisé (Commercial 04). Le nom du commercial n'est pas conservé.<br>Pseudonymisé (Commercial 04). | personnel |
| `commercial_id` | entier | Identifiant d'un commercial dans l'entrepôt, sans nom. | Codes commerciaux de Sage et propriétaires Salesforce | Aucune | personnel |

## dim_produit

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `article` | texte | Code de l'article facturé. | Sage, contrat sage_ca_facture, colonne « Article » | Conservé tel quel. | interne |
| `produit_id` | entier | Identifiant de l'article. | Articles du CA facturé Sage | Aucune | interne |
| `famille_id` | entier | Famille d'articles (dim_famille_produit). | Articles du CA facturé Sage | Aucune | interne |

## dim_famille_produit

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `famille_statistique` | texte | Famille d'articles utilisée pour les statistiques de vente. | Sage, contrat sage_ca_facture, colonne « Famille statistique » | Conservé tel quel. | interne |
| `famille_id` | entier | Identifiant de la famille d'articles. | Familles statistiques du CA facturé Sage | Aucune | interne |

## dim_compte

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `compte_general` | entier | Compte comptable de produit. Il permet de séparer le négoce du reste du CA. | Sage, contrat sage_ca_facture, colonne « Comptes généraux »<br>Sage, contrat sage_marge_brute, colonne « Comptes généraux » | Rattaché à dim_compte puis à sa classe (dim_classe_compte).<br>Rattaché à dim_compte et à sa classe. | interne |
| `famille_charge` | texte | Famille détaillée du compte : CA production, CA négoce, sous-traitance, loyers… | Sage, contrat sage_marge_brute, colonne « LIB 2 » | Sert à isoler le négoce (CA NEGOCE, ACHATS NEGOCE). | interne |
| `compte_id` | entier | Identifiant du compte comptable. | Comptes généraux de la marge et du CA facturé Sage | Aucune | interne |
| `classe_id` | entier | Classe du compte (dim_classe_compte). | Comptes généraux de la marge et du CA facturé Sage | Aucune | interne |

## dim_classe_compte

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `libelle` | texte | Grande famille du compte : CA, achats, services extérieurs, charges de personnel, impôts… | Sage, contrat sage_marge_brute, colonne « LIB 1 » | Sert à distinguer produits et charges. | interne |
| `est_produit` | booléen | Vrai si le compte est un compte de produit (classe 70). | Calculée (sage_marge_brute) | Vrai quand le compte général commence par 70. | interne |
| `est_negoce` | booléen | Vrai si le compte relève du négoce (CA NEGOCE ou ACHATS NEGOCE). | Calculée (sage_marge_brute) | Vrai quand au moins un compte de la classe a un LIB 2 de négoce (CA NEGOCE, ACHATS NEGOCE). | interne |
| `classe_id` | entier | Identifiant de la classe de compte. | Colonne LIB 1 de la marge Sage | Aucune | interne |

## dim_statut_opportunite

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `type_affaire` | texte | Nouveau Business, Fertilisation, Remise en concurrence ou Renouvellement Client. | Salesforce, contrat salesforce_opportunites, colonne « Type d'affaire » | Nouveau Business reste séparé de la continuité (les trois autres). | interne |
| `est_gagnee` | booléen | Vrai si le motif de clôture commence par Gagnée. | Calculée (salesforce_opportunites) | Déduit du motif de clôture. | interne |
| `statut_id` | entier | Identifiant de la combinaison étape, motif et type d'affaire. | Combinaisons étape, motif et type d'affaire des opportunités Salesforce | Aucune | interne |
| `etape_id` | entier | Étape du pipeline (dim_etape). | Combinaisons étape, motif et type d'affaire des opportunités Salesforce | Aucune | interne |
| `motif_id` | entier | Motif de clôture (dim_motif_cloture). | Combinaisons étape, motif et type d'affaire des opportunités Salesforce | Aucune | interne |

## dim_etape

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `libelle` | texte | Étape du pipeline : À venir, En cours, Envoyée, Proposition en attente de validation, Fermée, Abandon projet client. | Salesforce, contrat salesforce_opportunites, colonne « Étape » | Conservée telle quelle. | interne |
| `etape_id` | entier | Identifiant de l'étape. | Colonne Étape des opportunités Salesforce | Aucune | interne |

## dim_motif_cloture

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `libelle` | texte | Motif quand l'opportunité est fermée : Gagnée, Perdue, Abandonnée, No Go. Vide tant qu'elle est ouverte. | Salesforce, contrat salesforce_opportunites, colonne « Motif de clôture » | Conservé tel quel. | interne |
| `motif_id` | entier | Identifiant du motif de clôture. | Colonne Motif de clôture des opportunités Salesforce | Aucune | interne |

## stg_tickets

Grain : Un ticket.

| Colonne | Type | Définition | Origine | Règle de transformation | Sensibilité |
|---|---|---|---|---|---|
| `reference` | texte | Référence du ticket iTop. | iTop, contrat itop_tickets, colonne « Référence » | Conservée telle quelle. | interne |
| `type` | texte | incident ou demande. Seuls les incidents comptent dans les KPI. | iTop, contrat itop_tickets, colonne « Type » | Conservé tel quel. | interne |
| `priorite` | texte | Priorité du ticket, avec un suffixe interne ou client (Important Interne, Urgent Client…). Le suffixe indique probablement qui a ouvert le ticket (à confirmer). | iTop, contrat itop_tickets, colonne « Priorité » | Conservée telle quelle. | interne |
| `etat` | texte | État du ticket : Fermée, Résolu, Affecté, Assigné, En attente, Réaffecté, Arbitrage. | iTop, contrat itop_tickets, colonne « Etat » | Conservé tel quel. | interne |
| `code_sage` | texte | Code Sage du client concerné par le ticket, retrouvé à partir de l'organisation du demandeur. | iTop, contrat itop_tickets, colonne « Demandeur->Nom organisation » | L'organisation est rapprochée du code Sage par la table de correspondance fournie par l'entreprise (organisation iTop, code Sage). Le nom de l'organisation n'est pas conservé. Sans correspondance, le code reste vide. | confidentiel |
| `date_debut` | date | Date de création du ticket. | iTop, contrat itop_tickets, colonne « Date de début » | Conservée telle quelle. | interne |
| `date_resolution` | date | Date de résolution du ticket. Vide pour un ticket non résolu. | iTop, contrat itop_tickets, colonne « Date de résolution » | Conservée telle quelle. | interne |
| `impact` | texte | Un collaborateur, plusieurs collaborateurs, un seul client ou plusieurs clients impactés. | iTop, contrat itop_tickets, colonne « Niveau d'impact » | Conservé tel quel. | interne |
| `sla_ttr_depasse` | booléen | oui si le délai de résolution contractuel est dépassé (environ 9 % des tickets). | iTop, contrat itop_tickets, colonne « SLA TTR dépassé ? » | oui devient 1, non devient 0. | interne |
| `reference_salesforce` | entier | Référence du ticket Salesforce lié (environ 5,5 % des tickets). Sert à supprimer les doublons entre iTop et Salesforce. | iTop, contrat itop_tickets, colonne « Référence ticket Salesforce » | Conservée telle quelle. | interne |

## Sensibilité des colonnes

| Niveau | Colonnes |
|---|---|
| personnel | 2 |
| confidentiel | 10 |
| interne | 90 |

Colonnes personnelles (à pseudonymiser) :

- `dim_commercial.code_commercial`
- `dim_commercial.commercial_id`
