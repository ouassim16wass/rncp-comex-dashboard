with facture as (
    select periode, sum(ca_ht) as ca_facture, sum(nb_clients) as nb_clients_domaines
    from {{ ref('mart_ca_mensuel') }}
    group by 1
),
comptable as (
    select periode, sum(ca_comptable) as ca_comptable, sum(achats) as achats, sum(marge_brute) as marge_brute
    from {{ ref('mart_marge_mensuelle') }}
    group by 1
)
select
    coalesce(f.periode, c.periode) as periode,
    f.ca_facture,
    c.ca_comptable,
    c.achats,
    c.marge_brute,
    round(c.marge_brute / nullif(c.ca_comptable, 0), 4) as taux_marge,
    round((c.ca_comptable - f.ca_facture) / nullif(f.ca_facture, 0), 4) as ecart_ca_pct
from facture f
full join comptable c on c.periode = f.periode
