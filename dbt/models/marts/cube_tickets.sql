{{ config(indexes=[{'columns': ['date_debut']}]) }}

select
    reference,
    type,
    priorite,
    case
        when priorite like '% Client' then 'Client'
        when priorite like '% Interne' then 'Interne'
        else 'Non renseigné'
    end as origine,
    coalesce(split_part(priorite, ' ', 1), 'Non renseigné') as niveau_priorite,
    coalesce(etat, 'Non renseigné') as etat,
    coalesce(impact, 'Non renseigné') as impact,
    date_debut,
    date_trunc('week', date_debut)::date as semaine,
    date_resolution,
    case when date_resolution >= date_debut then date_resolution - date_debut end as jours_resolution,
    sla_ttr_depasse,
    code_sage,
    reference_salesforce
from {{ source('staging', 'stg_tickets') }}
