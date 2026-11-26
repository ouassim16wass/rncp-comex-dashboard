select
    periode,
    domaine,
    -coalesce(sum(montant_signe) filter (where classe like '1-%'), 0) as ca_comptable,
    -coalesce(sum(montant_signe) filter (where famille_charge = 'CA NEGOCE'), 0) as ca_negoce,
    coalesce(sum(montant_signe) filter (where classe like '2-%'), 0) as achats,
    -coalesce(sum(montant_signe) filter (where classe like '1-%'), 0)
        - coalesce(sum(montant_signe) filter (where classe like '2-%'), 0) as marge_brute,
    coalesce(sum(montant_signe) filter (where classe not like '1-%'), 0) as charges_totales
from {{ ref('int_marge') }}
group by 1, 2
