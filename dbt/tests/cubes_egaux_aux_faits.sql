select 'facturation' as cube, a.n as attendu, b.n as obtenu
from (select count(*) as n from {{ source('dwh', 'fait_facturation') }}) a, (select count(*) as n from {{ ref('cube_facturation') }}) b
where a.n <> b.n
union all
select 'marge', a.n, b.n
from (select count(*) as n from {{ source('dwh', 'fait_marge') }}) a, (select count(*) as n from {{ ref('cube_marge') }}) b
where a.n <> b.n
union all
select 'echeances', a.n, b.n
from (select count(*) as n from {{ source('dwh', 'fait_echeance') }}) a, (select count(*) as n from {{ ref('cube_echeances') }}) b
where a.n <> b.n
union all
select 'pipeline', a.n, b.n
from (select count(*) as n from {{ source('dwh', 'fait_opportunite') }}) a, (select count(*) as n from {{ ref('cube_pipeline') }}) b
where a.n <> b.n
