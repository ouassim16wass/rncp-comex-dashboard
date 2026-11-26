select * from {{ source('dwh', 'dim_statut_opportunite') }}
