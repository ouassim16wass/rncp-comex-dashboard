select
    tiers_id,
    code_sage,
    segment,
    periode,
    sum(montant_ht) as ca_ht,
    count(distinct no_facture) as nb_factures
from {{ ref('int_facturation') }}
where not hors_ca
group by 1, 2, 3, 4
