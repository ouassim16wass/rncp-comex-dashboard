INSERT INTO dwh.dim_domaine (domaine_id, domaine)
SELECT (SELECT coalesce(max(domaine_id), 0) FROM dwh.dim_domaine) + row_number() OVER (ORDER BY n.domaine), n.domaine
FROM (SELECT DISTINCT domaine FROM staging.stg_ca WHERE domaine IS NOT NULL) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_domaine d WHERE d.domaine = n.domaine);

INSERT INTO dwh.dim_mois_facturation (mois_facturation_id, mois_sage, annee)
SELECT DISTINCT annee_mois_sage * 100 + mois_sage, mois_sage, annee_mois_sage
FROM staging.stg_ca
ON CONFLICT DO NOTHING;

INSERT INTO dwh.dim_tiers (tiers_id, code_sage, raison_sociale_pseudo, type_tiers_id, segment_id)
SELECT (SELECT coalesce(max(tiers_id), 0) FROM dwh.dim_tiers) + row_number() OVER (ORDER BY n.code_sage),
       n.code_sage, n.raison_sociale_pseudo, 1, sg.segment_id
FROM (
    SELECT DISTINCT ON (code_sage) code_sage, raison_sociale_pseudo, segment
    FROM staging.stg_ca
    ORDER BY code_sage, date_facture DESC
) n
JOIN dwh.dim_segment sg ON sg.libelle = n.segment
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_tiers t WHERE t.code_sage = n.code_sage);

UPDATE dwh.dim_tiers t
SET raison_sociale_pseudo = n.raison_sociale_pseudo, segment_id = sg.segment_id
FROM (
    SELECT DISTINCT ON (code_sage) code_sage, raison_sociale_pseudo, segment
    FROM staging.stg_ca
    ORDER BY code_sage, date_facture DESC
) n
JOIN dwh.dim_segment sg ON sg.libelle = n.segment
WHERE t.code_sage = n.code_sage AND t.type_tiers_id = 1;

INSERT INTO dwh.dim_service (service_id, code_service, domaine_id)
SELECT (SELECT coalesce(max(service_id), 0) FROM dwh.dim_service) + row_number() OVER (ORDER BY n.code_service),
       n.code_service, d.domaine_id
FROM (
    SELECT DISTINCT ON (code_service) code_service, coalesce(domaine, 'non affecté') AS domaine
    FROM (
        SELECT code_service, domaine, count(*) AS nb
        FROM staging.stg_ca
        GROUP BY code_service, domaine
    ) c
    ORDER BY code_service, (domaine IS NULL), nb DESC
) n
JOIN dwh.dim_domaine d ON d.domaine = n.domaine
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_service s WHERE s.code_service = n.code_service);

INSERT INTO dwh.dim_commercial (commercial_id, code_commercial)
SELECT (SELECT coalesce(max(commercial_id), 0) FROM dwh.dim_commercial) + row_number() OVER (ORDER BY n.code_commercial),
       n.code_commercial
FROM (SELECT DISTINCT code_commercial FROM staging.stg_ca WHERE code_commercial IS NOT NULL) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_commercial c WHERE c.code_commercial = n.code_commercial);

INSERT INTO dwh.dim_famille_produit (famille_id, famille_statistique)
SELECT (SELECT coalesce(max(famille_id), 0) FROM dwh.dim_famille_produit) + row_number() OVER (ORDER BY n.famille_statistique),
       n.famille_statistique
FROM (SELECT DISTINCT famille_statistique FROM staging.stg_ca WHERE famille_statistique IS NOT NULL) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_famille_produit f WHERE f.famille_statistique = n.famille_statistique);

INSERT INTO dwh.dim_produit (produit_id, article, famille_id)
SELECT (SELECT coalesce(max(produit_id), 0) FROM dwh.dim_produit) + row_number() OVER (ORDER BY n.article),
       n.article, f.famille_id
FROM (
    SELECT DISTINCT ON (article) article, famille_statistique
    FROM staging.stg_ca
    WHERE article IS NOT NULL
    ORDER BY article, (famille_statistique IS NULL), date_facture DESC
) n
LEFT JOIN dwh.dim_famille_produit f ON f.famille_statistique = n.famille_statistique
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_produit p WHERE p.article = n.article);

INSERT INTO dwh.dim_compte (compte_id, compte_general)
SELECT (SELECT coalesce(max(compte_id), 0) FROM dwh.dim_compte) + row_number() OVER (ORDER BY n.compte_general),
       n.compte_general
FROM (SELECT DISTINCT compte_general FROM staging.stg_ca WHERE compte_general IS NOT NULL) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_compte c WHERE c.compte_general = n.compte_general);

TRUNCATE dwh.fait_facturation;

INSERT INTO dwh.fait_facturation (
    ligne_facture_id, date_facture_id, mois_facturation_id, tiers_id, produit_id, service_id, commercial_id,
    compte_id, no_facture, type_facture, build_run, quantite, montant_ht
)
SELECT row_number() OVER (ORDER BY s.date_facture, s.no_facture, s.article, s.montant_ht),
       dd.date_id, mf.mois_facturation_id, t.tiers_id, p.produit_id, sv.service_id, c.commercial_id,
       cp.compte_id, s.no_facture, s.type_facture, s.build_run, s.quantite, s.montant_ht
FROM staging.stg_ca s
JOIN dwh.dim_date dd ON dd.date = s.date_facture
JOIN dwh.dim_tiers t ON t.code_sage = s.code_sage
LEFT JOIN dwh.dim_mois_facturation mf ON mf.mois_sage = s.mois_sage AND mf.annee = s.annee_mois_sage
LEFT JOIN dwh.dim_produit p ON p.article = s.article
LEFT JOIN dwh.dim_service sv ON sv.code_service = s.code_service
LEFT JOIN dwh.dim_commercial c ON c.code_commercial = s.code_commercial
LEFT JOIN dwh.dim_compte cp ON cp.compte_general = s.compte_general;
