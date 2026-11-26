select
    periode,
    annee,
    mois,
    domaine,
    segment,
    sum(montant_ht) as ca_ht,
    count(distinct no_facture) as nb_factures,
    count(distinct tiers_id) as nb_clients
from {{ ref('int_facturation') }}
where not hors_ca
group by 1, 2, 3, 4, 5
