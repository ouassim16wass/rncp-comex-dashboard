select * from {{ source('dwh', 'dim_etape') }}
