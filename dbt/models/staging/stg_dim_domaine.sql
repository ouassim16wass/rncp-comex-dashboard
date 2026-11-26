select * from {{ source('dwh', 'dim_domaine') }}
