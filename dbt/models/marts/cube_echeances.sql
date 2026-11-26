{{ config(indexes=[{'columns': ['date_photo']}, {'columns': ['tiers_id']}]) }}

select * from {{ ref('int_echeances') }}
