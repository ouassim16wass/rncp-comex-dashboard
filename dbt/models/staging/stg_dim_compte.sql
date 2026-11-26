select * from {{ source('dwh', 'dim_compte') }}
