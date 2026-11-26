select * from {{ source('dwh', 'dim_date') }}
