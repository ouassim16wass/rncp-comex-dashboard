{{ config(indexes=[{'columns': ['date_photo']}, {'columns': ['domaine']}]) }}

select * from {{ ref('int_opportunites') }}
