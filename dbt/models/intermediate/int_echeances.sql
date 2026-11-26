select
    f.echeance_id,
    dd.date as date_photo,
    f.sens,
    f.tranche_retard,
    f.jours_retard,
    f.solde,
    f.tiers_id,
    t.raison_sociale_pseudo as client,
    coalesce(seg.libelle, 'Non classé') as segment
from {{ ref('stg_fait_echeance') }} f
join {{ ref('stg_dim_date') }} dd on dd.date_id = f.date_photo_id
join {{ ref('stg_dim_tiers') }} t on t.tiers_id = f.tiers_id
left join {{ ref('stg_dim_segment') }} seg on seg.segment_id = t.segment_id
