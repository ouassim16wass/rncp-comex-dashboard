select
    f.ecriture_id,
    dd.mois_id as periode,
    dm.trimestre_id as trimestre,
    tr.annee,
    dd.date as date_comptable,
    dom.domaine,
    cl.libelle as classe,
    cp.famille_charge,
    coalesce(f.build_run, 'Non renseigné') as build_run,
    f.type_piece,
    f.section_analytique,
    f.tiers_id,
    coalesce(t.raison_sociale_pseudo, 'Sans tiers') as client,
    f.montant_signe
from {{ ref('stg_fait_marge') }} f
join {{ ref('stg_dim_date') }} dd on dd.date_id = f.date_comptable_id
join {{ ref('stg_dim_mois') }} dm on dm.mois_id = dd.mois_id
join {{ ref('stg_dim_trimestre') }} tr on tr.trimestre_id = dm.trimestre_id
join {{ ref('stg_dim_compte') }} cp on cp.compte_id = f.compte_id
join {{ ref('stg_dim_classe_compte') }} cl on cl.classe_id = cp.classe_id
join {{ ref('stg_dim_domaine') }} dom on dom.domaine_id = f.domaine_id
left join {{ ref('stg_dim_tiers') }} t on t.tiers_id = f.tiers_id
