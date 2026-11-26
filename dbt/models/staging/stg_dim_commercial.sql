select * from {{ source('dwh', 'dim_commercial') }}
