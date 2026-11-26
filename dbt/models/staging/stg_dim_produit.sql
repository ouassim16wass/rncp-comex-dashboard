select * from {{ source('dwh', 'dim_produit') }}
