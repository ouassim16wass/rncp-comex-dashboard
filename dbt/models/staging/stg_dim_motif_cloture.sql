select * from {{ source('dwh', 'dim_motif_cloture') }}
