{{ config(severity='warn') }}

select ligne_facture_id, type_facture, montant_ht
from {{ source('dwh', 'fait_facturation') }}
where (type_facture = 'AVO' and montant_ht > 0) or (type_facture = 'FAC' and montant_ht < 0)
