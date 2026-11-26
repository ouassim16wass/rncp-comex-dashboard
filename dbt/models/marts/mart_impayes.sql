select
    date_photo,
    sens,
    tranche_retard,
    segment,
    count(*) as nb_pieces,
    count(distinct tiers_id) as nb_tiers,
    sum(solde) as solde
from {{ ref('int_echeances') }}
group by 1, 2, 3, 4
