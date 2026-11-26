select * from {{ source('dwh', 'dim_trimestre') }}
