select * from {{ source('dwh', 'dim_type_tiers') }}
