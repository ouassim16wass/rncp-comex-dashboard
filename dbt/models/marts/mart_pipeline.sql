select
    date_photo,
    domaine,
    etape,
    est_gagnee,
    count(*) as nb_opportunites,
    coalesce(sum(montant_global), 0) as montant_global
from {{ ref('int_opportunites') }}
group by 1, 2, 3, 4
