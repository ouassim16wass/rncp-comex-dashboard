with attendu as (
    select sum(f.montant_ht) as total
    from {{ source('dwh', 'fait_facturation') }} f
    join {{ source('dwh', 'dim_service') }} sv on sv.service_id = f.service_id
    where sv.code_service <> 990
),
mart as (
    select sum(ca_ht) as total from {{ ref('mart_ca_mensuel') }}
)
select attendu.total as attendu, mart.total as obtenu
from attendu, mart
where abs(attendu.total - mart.total) > 0.01
