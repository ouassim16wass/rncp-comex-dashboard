{{ config(indexes=[{'columns': ['periode']}, {'columns': ['domaine']}, {'columns': ['classe']}]) }}

select * from {{ ref('int_marge') }}
