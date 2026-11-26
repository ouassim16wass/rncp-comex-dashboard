select * from {{ source('dwh', 'dim_famille_produit') }}
