select * from {{ source('dwh', 'dim_segment') }}
