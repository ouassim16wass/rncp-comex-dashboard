select a.total as attendu, b.total as obtenu
from (select sum(montant_ht) as total from {{ source('dwh', 'fait_facturation') }}) a,
     (select sum(montant_ht) as total from {{ ref('cube_facturation') }}) b
where abs(a.total - b.total) > 0.01
