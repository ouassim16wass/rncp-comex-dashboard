select a.n as attendu, b.n as obtenu
from (select count(*) as n from {{ source('staging', 'stg_tickets') }}) a, (select count(*) as n from {{ ref('cube_tickets') }}) b
where a.n <> b.n
