CREATE DATABASE entrepot_demo;
\connect entrepot_demo
\i /docker-entrypoint-initdb.d/01_schema.sql
