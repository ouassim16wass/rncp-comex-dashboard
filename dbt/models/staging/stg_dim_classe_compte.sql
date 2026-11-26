select * from {{ source('dwh', 'dim_classe_compte') }}
