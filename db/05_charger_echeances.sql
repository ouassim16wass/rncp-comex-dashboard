INSERT INTO dwh.dim_tiers (tiers_id, code_sage, raison_sociale_pseudo, type_tiers_id, segment_id)
SELECT (SELECT coalesce(max(tiers_id), 0) FROM dwh.dim_tiers) + row_number() OVER (ORDER BY n.code_sage),
       n.code_sage, coalesce(n.raison_sociale_pseudo, 'Tiers ' || n.code_sage),
       CASE WHEN n.sens = 'créance' THEN 1 ELSE 2 END, sg.segment_id
FROM (
    SELECT DISTINCT ON (code_sage) code_sage, raison_sociale_pseudo, segment, sens
    FROM staging.stg_echeances
    ORDER BY code_sage, date_photo DESC
) n
LEFT JOIN dwh.dim_segment sg ON sg.libelle = n.segment
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_tiers t WHERE t.code_sage = n.code_sage);

UPDATE dwh.dim_tiers t
SET segment_id = sg.segment_id
FROM (
    SELECT DISTINCT ON (code_sage) code_sage, segment
    FROM staging.stg_echeances
    WHERE segment IS NOT NULL
    ORDER BY code_sage, date_photo DESC
) n
JOIN dwh.dim_segment sg ON sg.libelle = n.segment
WHERE t.code_sage = n.code_sage;

DELETE FROM dwh.fait_echeance f
USING dwh.dim_date d
WHERE d.date_id = f.date_photo_id
  AND d.date IN (SELECT DISTINCT date_photo FROM staging.stg_echeances)
  AND f.sens IN (SELECT DISTINCT sens FROM staging.stg_echeances);

INSERT INTO dwh.fait_echeance (
    echeance_id, date_photo_id, date_echeance_id, tiers_id, solde, type_piece, reference_piece, sens,
    jours_retard, tranche_retard
)
SELECT (SELECT coalesce(max(echeance_id), 0) FROM dwh.fait_echeance)
           + row_number() OVER (ORDER BY s.date_photo, s.code_sage, s.date_echeance, s.reference_piece, s.solde),
       dp.date_id, de.date_id, t.tiers_id, s.solde, s.type_piece, s.reference_piece, s.sens, s.jours_retard,
       s.tranche_retard
FROM staging.stg_echeances s
JOIN dwh.dim_date dp ON dp.date = s.date_photo
JOIN dwh.dim_tiers t ON t.code_sage = s.code_sage
LEFT JOIN dwh.dim_date de ON de.date = s.date_echeance;
