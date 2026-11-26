INSERT INTO dwh.dim_domaine (domaine_id, domaine)
SELECT (SELECT coalesce(max(domaine_id), 0) FROM dwh.dim_domaine) + row_number() OVER (ORDER BY n.domaine), n.domaine
FROM (SELECT DISTINCT domaine FROM staging.stg_opportunites WHERE domaine IS NOT NULL) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_domaine d WHERE d.domaine = n.domaine);

INSERT INTO dwh.dim_etape (etape_id, libelle)
SELECT (SELECT coalesce(max(etape_id), 0) FROM dwh.dim_etape) + row_number() OVER (ORDER BY n.etape), n.etape
FROM (SELECT DISTINCT etape FROM staging.stg_opportunites WHERE etape IS NOT NULL) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_etape e WHERE e.libelle = n.etape);

INSERT INTO dwh.dim_motif_cloture (motif_id, libelle)
SELECT (SELECT coalesce(max(motif_id), 0) FROM dwh.dim_motif_cloture) + row_number() OVER (ORDER BY n.motif_cloture),
       n.motif_cloture
FROM (SELECT DISTINCT motif_cloture FROM staging.stg_opportunites WHERE motif_cloture IS NOT NULL) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_motif_cloture m WHERE m.libelle = n.motif_cloture);

INSERT INTO dwh.dim_statut_opportunite (statut_id, type_affaire, est_gagnee, etape_id, motif_id)
SELECT (SELECT coalesce(max(statut_id), 0) FROM dwh.dim_statut_opportunite)
           + row_number() OVER (ORDER BY n.type_affaire, n.etape, n.motif_cloture),
       n.type_affaire, n.est_gagnee, e.etape_id, m.motif_id
FROM (
    SELECT DISTINCT type_affaire, est_gagnee, etape, motif_cloture FROM staging.stg_opportunites
) n
JOIN dwh.dim_etape e ON e.libelle = n.etape
LEFT JOIN dwh.dim_motif_cloture m ON m.libelle = n.motif_cloture
WHERE NOT EXISTS (
    SELECT 1 FROM dwh.dim_statut_opportunite s
    WHERE s.type_affaire IS NOT DISTINCT FROM n.type_affaire
      AND s.est_gagnee = n.est_gagnee
      AND s.etape_id = e.etape_id
      AND s.motif_id IS NOT DISTINCT FROM m.motif_id
);

INSERT INTO dwh.dim_tiers (tiers_id, code_sage, raison_sociale_pseudo, type_tiers_id, segment_id)
SELECT (SELECT coalesce(max(tiers_id), 0) FROM dwh.dim_tiers) + 1, 'NON_RAPPROCHE', 'Non rapproché', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_tiers WHERE code_sage = 'NON_RAPPROCHE');

INSERT INTO dwh.dim_commercial (commercial_id, code_commercial)
SELECT (SELECT coalesce(max(commercial_id), 0) FROM dwh.dim_commercial) + row_number() OVER (ORDER BY n.code_commercial),
       n.code_commercial
FROM (SELECT DISTINCT code_commercial FROM staging.stg_opportunites WHERE code_commercial IS NOT NULL) n
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_commercial c WHERE c.code_commercial = n.code_commercial);

DELETE FROM dwh.fait_opportunite f
USING dwh.dim_date d
WHERE d.date_id = f.date_photo_id
  AND d.date IN (SELECT DISTINCT date_photo FROM staging.stg_opportunites);

INSERT INTO dwh.fait_opportunite (
    opportunite_photo_id, date_photo_id, tiers_id, commercial_id, domaine_id, statut_id, montant_global, nb_mois
)
SELECT (SELECT coalesce(max(opportunite_photo_id), 0) FROM dwh.fait_opportunite)
           + row_number() OVER (ORDER BY s.date_photo, s.code_sage, s.etape, s.montant_global),
       dp.date_id, t.tiers_id, c.commercial_id, dm.domaine_id, st.statut_id, s.montant_global, s.nb_mois
FROM staging.stg_opportunites s
JOIN dwh.dim_date dp ON dp.date = s.date_photo
JOIN dwh.dim_tiers t ON t.code_sage = s.code_sage
JOIN dwh.dim_etape e ON e.libelle = s.etape
LEFT JOIN dwh.dim_motif_cloture m ON m.libelle = s.motif_cloture
JOIN dwh.dim_statut_opportunite st
     ON st.type_affaire IS NOT DISTINCT FROM s.type_affaire
    AND st.est_gagnee = s.est_gagnee
    AND st.etape_id = e.etape_id
    AND st.motif_id IS NOT DISTINCT FROM m.motif_id
LEFT JOIN dwh.dim_commercial c ON c.code_commercial = s.code_commercial
LEFT JOIN dwh.dim_domaine dm ON dm.domaine = s.domaine;

INSERT INTO dwh.ref_client_correspondance (tiers_id, id_salesforce, methode, confiance)
SELECT DISTINCT ON (t.tiers_id) t.tiers_id, s.cle_salesforce, s.methode, s.confiance
FROM staging.stg_opportunites s
JOIN dwh.dim_tiers t ON t.code_sage = s.code_sage
WHERE s.cle_salesforce IS NOT NULL
ORDER BY t.tiers_id, s.confiance DESC
ON CONFLICT (tiers_id) DO UPDATE
SET id_salesforce = EXCLUDED.id_salesforce, methode = EXCLUDED.methode, confiance = EXCLUDED.confiance;
