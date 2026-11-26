select
    f.opportunite_photo_id,
    dd.date as date_photo,
    coalesce(dom.domaine, 'non affecté') as domaine,
    e.libelle as etape,
    coalesce(m.libelle, 'Sans motif') as motif_cloture,
    coalesce(s.type_affaire, 'Non renseigné') as type_affaire,
    s.est_gagnee,
    coalesce(cm.code_commercial::text, 'Non renseigné') as commercial,
    t.raison_sociale_pseudo as client,
    coalesce(seg.libelle, 'Non classé') as segment,
    f.nb_mois,
    f.montant_global
from {{ ref('stg_fait_opportunite') }} f
join {{ ref('stg_dim_date') }} dd on dd.date_id = f.date_photo_id
join {{ ref('stg_dim_statut_opportunite') }} s on s.statut_id = f.statut_id
join {{ ref('stg_dim_etape') }} e on e.etape_id = s.etape_id
join {{ ref('stg_dim_tiers') }} t on t.tiers_id = f.tiers_id
left join {{ ref('stg_dim_segment') }} seg on seg.segment_id = t.segment_id
left join {{ ref('stg_dim_motif_cloture') }} m on m.motif_id = s.motif_id
left join {{ ref('stg_dim_domaine') }} dom on dom.domaine_id = f.domaine_id
left join {{ ref('stg_dim_commercial') }} cm on cm.commercial_id = f.commercial_id
