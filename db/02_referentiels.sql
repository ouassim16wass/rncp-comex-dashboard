INSERT INTO dwh.dim_type_tiers (type_tiers_id, libelle) VALUES (1, 'Client'), (2, 'Fournisseur')
ON CONFLICT DO NOTHING;

INSERT INTO dwh.dim_segment (segment_id, libelle)
VALUES (1, 'Groupe'), (2, 'Hors groupe'), (3, 'Public'), (4, 'Douteux')
ON CONFLICT DO NOTHING;

INSERT INTO dwh.dim_trimestre (trimestre_id, trimestre, annee)
SELECT DISTINCT extract(year FROM j)::int * 10 + extract(quarter FROM j)::int,
       extract(quarter FROM j)::int, extract(year FROM j)::int
FROM generate_series('2023-01-01'::date, '2030-12-31'::date, '1 day') AS j
ON CONFLICT DO NOTHING;

INSERT INTO dwh.dim_mois (mois_id, mois, libelle, trimestre_id)
SELECT DISTINCT extract(year FROM j)::int * 100 + extract(month FROM j)::int,
       extract(month FROM j)::int,
       (ARRAY['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month FROM j)::int]
           || ' ' || extract(year FROM j)::int,
       extract(year FROM j)::int * 10 + extract(quarter FROM j)::int
FROM generate_series('2023-01-01'::date, '2030-12-31'::date, '1 day') AS j
ON CONFLICT DO NOTHING;

INSERT INTO dwh.dim_date (date_id, date, mois_id)
SELECT to_char(j, 'YYYYMMDD')::int, j::date, extract(year FROM j)::int * 100 + extract(month FROM j)::int
FROM generate_series('2023-01-01'::date, '2030-12-31'::date, '1 day') AS j
ON CONFLICT DO NOTHING;

INSERT INTO dwh.dim_domaine (domaine_id, domaine)
SELECT (SELECT coalesce(max(domaine_id), 0) FROM dwh.dim_domaine) + 1, 'non affecté'
WHERE NOT EXISTS (SELECT 1 FROM dwh.dim_domaine WHERE domaine = 'non affecté');
