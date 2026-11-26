with attendu as (
    select sum(f.montant_signe) as total
    from {{ source('dwh', 'fait_marge') }} f
),
mart as (
    select sum(-ca_comptable + charges_totales) as total from {{ ref('mart_marge_mensuelle') }}
)
select attendu.total as attendu, mart.total as obtenu
from attendu, mart
where abs(attendu.total - mart.total) > 0.01
