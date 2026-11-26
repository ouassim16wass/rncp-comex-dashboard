select
    f.ligne_facture_id,
    f.no_facture,
    f.type_facture,
    coalesce(f.build_run, 'Non renseigné') as build_run,
    f.quantite,
    f.montant_ht,
    f.tiers_id,
    t.code_sage,
    t.raison_sociale_pseudo as client,
    coalesce(seg.libelle, 'Non classé') as segment,
    mf.annee * 100 + mf.mois_sage as periode,
    mf.annee,
    mf.mois_sage as mois,
    mf.annee * 10 + (mf.mois_sage - 1) / 3 + 1 as trimestre_sage,
    dd.date as date_facture,
    dd.mois_id as mois_civil,
    dm.trimestre_id as trimestre_civil,
    tr.annee as annee_civile,
    sv.code_service,
    sv.code_service = 990 as hors_ca,
    dom.domaine,
    coalesce(p.article, 'Non renseigné') as article,
    coalesce(fam.famille_statistique, 'Non renseignée') as famille,
    coalesce(cm.code_commercial::text, 'Non renseigné') as commercial
from {{ ref('stg_fait_facturation') }} f
join {{ ref('stg_dim_mois_facturation') }} mf on mf.mois_facturation_id = f.mois_facturation_id
join {{ ref('stg_dim_date') }} dd on dd.date_id = f.date_facture_id
join {{ ref('stg_dim_mois') }} dm on dm.mois_id = dd.mois_id
join {{ ref('stg_dim_trimestre') }} tr on tr.trimestre_id = dm.trimestre_id
join {{ ref('stg_dim_service') }} sv on sv.service_id = f.service_id
join {{ ref('stg_dim_domaine') }} dom on dom.domaine_id = sv.domaine_id
join {{ ref('stg_dim_tiers') }} t on t.tiers_id = f.tiers_id
left join {{ ref('stg_dim_segment') }} seg on seg.segment_id = t.segment_id
left join {{ ref('stg_dim_produit') }} p on p.produit_id = f.produit_id
left join {{ ref('stg_dim_famille_produit') }} fam on fam.famille_id = p.famille_id
left join {{ ref('stg_dim_commercial') }} cm on cm.commercial_id = f.commercial_id
