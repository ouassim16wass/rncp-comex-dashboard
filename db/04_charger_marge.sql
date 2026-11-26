INSERT INTO dwh.dim_domaine (domaine_id, domaine)
SELECT (SELECT coalesce(max(domaine_id), 0) FROM dwh.dim_domaine) + row_number() OVER (ORDER BY n.domaine), n.domaine
FROM (SELECT DISTINCT domaine FROM staging.stg_marge WHERE domaine IS NOT NULL) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_domaine d WHERE d.domaine = n.domaine);

INSERT INTO dwh.dim_classe_compte (classe_id, libelle, est_produit, est_negoce)
SELECT (SELECT coalesce(max(classe_id), 0) FROM dwh.dim_classe_compte) + row_number() OVER (ORDER BY n.lib_1),
       n.lib_1, n.lib_1 LIKE '1-%', n.negoce
FROM (SELECT lib_1, bool_or(lib_2 LIKE '%NEGOCE%') AS negoce FROM staging.stg_marge GROUP BY lib_1) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_classe_compte c WHERE c.libelle = n.lib_1);

INSERT INTO dwh.dim_compte (compte_id, compte_general)
SELECT (SELECT coalesce(max(compte_id), 0) FROM dwh.dim_compte) + row_number() OVER (ORDER BY n.compte_general),
       n.compte_general
FROM (SELECT DISTINCT compte_general FROM staging.stg_marge) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_compte c WHERE c.compte_general = n.compte_general);

UPDATE dwh.dim_compte c
SET famille_charge = n.lib_2, classe_id = cl.classe_id
FROM (SELECT DISTINCT compte_general, lib_1, lib_2 FROM staging.stg_marge) n
JOIN dwh.dim_classe_compte cl ON cl.libelle = n.lib_1
WHERE c.compte_general = n.compte_general;

INSERT INTO dwh.dim_tiers (tiers_id, code_sage, raison_sociale_pseudo, type_tiers_id, segment_id)
SELECT (SELECT coalesce(max(tiers_id), 0) FROM dwh.dim_tiers) + row_number() OVER (ORDER BY n.code_sage),
       n.code_sage, 'Tiers ' || n.code_sage, CASE WHEN n.client THEN 1 ELSE 2 END, NULL
FROM (
    SELECT code_sage, bool_or(compte_general::text LIKE '70%') AS client
    FROM staging.stg_marge
    WHERE code_sage IS NOT NULL
    GROUP BY code_sage
) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_tiers t WHERE t.code_sage = n.code_sage);

TRUNCATE dwh.fait_marge;

INSERT INTO dwh.fait_marge (
    ecriture_id, date_comptable_id, compte_id, domaine_id, tiers_id, type_piece, numero_piece, section_analytique,
    build_run, montant_signe
)
SELECT row_number() OVER (ORDER BY s.date_comptable, s.numero_piece, s.compte_general, s.montant_signe),
       dd.date_id, cp.compte_id, dm.domaine_id, t.tiers_id, s.type_piece, s.numero_piece, s.section_analytique,
       s.build_run, s.montant_signe
FROM staging.stg_marge s
JOIN dwh.dim_date dd ON dd.date = s.date_comptable
JOIN dwh.dim_compte cp ON cp.compte_general = s.compte_general
JOIN dwh.dim_domaine dm ON dm.domaine = coalesce(s.domaine, 'non affecté')
LEFT JOIN dwh.dim_tiers t ON t.code_sage = s.code_sage;
