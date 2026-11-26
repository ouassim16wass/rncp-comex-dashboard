with issues as (
    select
        date_photo,
        case
            when motif_cloture like 'Gagnée%' then 'gagnee'
            when motif_cloture = 'Perdue' then 'perdue'
            when motif_cloture = 'Abandonnée' or motif_cloture like 'No Go%' then 'abandon'
        end as issue
    from {{ ref('int_opportunites') }}
    where motif_cloture is not null
)
select
    date_photo,
    count(*) filter (where issue = 'gagnee') as nb_gagnees,
    count(*) filter (where issue = 'perdue') as nb_perdues,
    count(*) filter (where issue = 'abandon') as nb_abandons,
    round(count(*) filter (where issue = 'gagnee')::numeric
        / nullif(count(*) filter (where issue in ('gagnee', 'perdue')), 0), 4) as win_ratio_restreint,
    round(count(*) filter (where issue = 'gagnee')::numeric
        / nullif(count(*) filter (where issue is not null), 0), 4) as win_ratio_large
from issues
group by 1
