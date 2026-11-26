{{ config(indexes=[{'columns': ['periode']}, {'columns': ['mois_civil']}, {'columns': ['domaine']}, {'columns': ['tiers_id']}]) }}

select * from {{ ref('int_facturation') }}
