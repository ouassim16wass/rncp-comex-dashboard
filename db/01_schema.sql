CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS dwh;
CREATE SCHEMA IF NOT EXISTS supervision;

CREATE TABLE IF NOT EXISTS dwh.dim_trimestre (
    trimestre_id integer PRIMARY KEY,
    trimestre smallint NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
    annee smallint NOT NULL
);

CREATE TABLE IF NOT EXISTS dwh.dim_mois (
    mois_id integer PRIMARY KEY,
    mois smallint NOT NULL CHECK (mois BETWEEN 1 AND 12),
    libelle text NOT NULL,
    trimestre_id integer NOT NULL REFERENCES dwh.dim_trimestre
);

CREATE TABLE IF NOT EXISTS dwh.dim_date (
    date_id integer PRIMARY KEY,
    date date NOT NULL UNIQUE,
    mois_id integer NOT NULL REFERENCES dwh.dim_mois
);

CREATE TABLE IF NOT EXISTS dwh.dim_mois_facturation (
    mois_facturation_id integer PRIMARY KEY,
    mois_sage smallint NOT NULL,
    annee smallint NOT NULL,
    UNIQUE (mois_sage, annee)
);

CREATE TABLE IF NOT EXISTS dwh.dim_type_tiers (
    type_tiers_id integer PRIMARY KEY,
    libelle text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dwh.dim_segment (
    segment_id integer PRIMARY KEY,
    libelle text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dwh.dim_tiers (
    tiers_id integer PRIMARY KEY,
    code_sage text NOT NULL UNIQUE,
    raison_sociale_pseudo text NOT NULL,
    type_tiers_id integer NOT NULL REFERENCES dwh.dim_type_tiers,
    segment_id integer REFERENCES dwh.dim_segment
);

CREATE TABLE IF NOT EXISTS dwh.dim_domaine (
    domaine_id integer PRIMARY KEY,
    domaine text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dwh.dim_service (
    service_id integer PRIMARY KEY,
    code_service integer NOT NULL UNIQUE,
    domaine_id integer NOT NULL REFERENCES dwh.dim_domaine
);

CREATE TABLE IF NOT EXISTS dwh.dim_commercial (
    commercial_id integer PRIMARY KEY,
    code_commercial integer NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dwh.dim_famille_produit (
    famille_id integer PRIMARY KEY,
    famille_statistique text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dwh.dim_produit (
    produit_id integer PRIMARY KEY,
    article text NOT NULL UNIQUE,
    famille_id integer REFERENCES dwh.dim_famille_produit
);

CREATE TABLE IF NOT EXISTS dwh.dim_classe_compte (
    classe_id integer PRIMARY KEY,
    libelle text NOT NULL UNIQUE,
    est_produit boolean NOT NULL,
    est_negoce boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS dwh.dim_compte (
    compte_id integer PRIMARY KEY,
    compte_general integer NOT NULL UNIQUE,
    famille_charge text,
    classe_id integer REFERENCES dwh.dim_classe_compte
);

CREATE TABLE IF NOT EXISTS dwh.dim_etape (
    etape_id integer PRIMARY KEY,
    libelle text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dwh.dim_motif_cloture (
    motif_id integer PRIMARY KEY,
    libelle text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dwh.dim_statut_opportunite (
    statut_id integer PRIMARY KEY,
    type_affaire text,
    est_gagnee boolean NOT NULL,
    etape_id integer NOT NULL REFERENCES dwh.dim_etape,
    motif_id integer REFERENCES dwh.dim_motif_cloture
);

CREATE TABLE IF NOT EXISTS dwh.fait_facturation (
    ligne_facture_id bigint PRIMARY KEY,
    date_facture_id integer NOT NULL REFERENCES dwh.dim_date,
    mois_facturation_id integer REFERENCES dwh.dim_mois_facturation,
    tiers_id integer NOT NULL REFERENCES dwh.dim_tiers,
    produit_id integer REFERENCES dwh.dim_produit,
    service_id integer REFERENCES dwh.dim_service,
    commercial_id integer REFERENCES dwh.dim_commercial,
    compte_id integer REFERENCES dwh.dim_compte,
    no_facture text NOT NULL,
    type_facture text,
    build_run text,
    quantite numeric(18, 4),
    montant_ht numeric(18, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS dwh.fait_marge (
    ecriture_id bigint PRIMARY KEY,
    date_comptable_id integer NOT NULL REFERENCES dwh.dim_date,
    compte_id integer NOT NULL REFERENCES dwh.dim_compte,
    domaine_id integer REFERENCES dwh.dim_domaine,
    tiers_id integer REFERENCES dwh.dim_tiers,
    type_piece text,
    numero_piece text,
    section_analytique integer,
    build_run text,
    montant_signe numeric(18, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS dwh.fait_echeance (
    echeance_id bigint PRIMARY KEY,
    date_photo_id integer NOT NULL REFERENCES dwh.dim_date,
    date_echeance_id integer REFERENCES dwh.dim_date,
    tiers_id integer NOT NULL REFERENCES dwh.dim_tiers,
    solde numeric(18, 2) NOT NULL,
    type_piece text,
    reference_piece text,
    sens text NOT NULL CHECK (sens IN ('créance', 'dette')),
    jours_retard integer,
    tranche_retard text
);

CREATE TABLE IF NOT EXISTS dwh.fait_opportunite (
    opportunite_photo_id bigint PRIMARY KEY,
    date_photo_id integer NOT NULL REFERENCES dwh.dim_date,
    tiers_id integer REFERENCES dwh.dim_tiers,
    commercial_id integer REFERENCES dwh.dim_commercial,
    domaine_id integer REFERENCES dwh.dim_domaine,
    statut_id integer NOT NULL REFERENCES dwh.dim_statut_opportunite,
    montant_global numeric(18, 2),
    nb_mois integer
);

CREATE TABLE IF NOT EXISTS dwh.ref_client_correspondance (
    tiers_id integer PRIMARY KEY REFERENCES dwh.dim_tiers,
    id_salesforce text,
    id_itop text,
    methode text NOT NULL,
    confiance numeric(3, 2) NOT NULL CHECK (confiance BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS supervision.execution (
    execution_id bigserial PRIMARY KEY,
    etape text NOT NULL,
    source text NOT NULL,
    debut timestamptz NOT NULL DEFAULT now(),
    duree_s numeric(10, 2),
    lignes_lues integer,
    lignes_chargees integer,
    lignes_rejetees integer,
    taux_rejet numeric(6, 4),
    statut text NOT NULL CHECK (statut IN ('ok', 'alerte', 'echec')),
    message text,
    somme_brute numeric(20, 2),
    somme_staging numeric(20, 2),
    somme_entrepot numeric(20, 2),
    mesure_controlee text
);

CREATE TABLE IF NOT EXISTS supervision.quarantaine (
    quarantaine_id bigserial PRIMARY KEY,
    execution_id bigint NOT NULL REFERENCES supervision.execution,
    source text NOT NULL,
    colonne text,
    regle text NOT NULL,
    nb_lignes integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_facturation_tiers ON dwh.fait_facturation (tiers_id);
CREATE INDEX IF NOT EXISTS idx_facturation_date ON dwh.fait_facturation (date_facture_id);
CREATE INDEX IF NOT EXISTS idx_marge_date ON dwh.fait_marge (date_comptable_id);
CREATE INDEX IF NOT EXISTS idx_echeance_photo ON dwh.fait_echeance (date_photo_id, tiers_id);
CREATE INDEX IF NOT EXISTS idx_opportunite_photo ON dwh.fait_opportunite (date_photo_id);

CREATE TABLE IF NOT EXISTS supervision.score_historique (
    score_id bigserial PRIMARY KEY,
    date_score date NOT NULL,
    periode integer NOT NULL,
    version text NOT NULL,
    tiers_id integer NOT NULL,
    probabilite numeric(7, 5) NOT NULL,
    niveau text NOT NULL,
    UNIQUE (date_score, version, tiers_id)
);

CREATE TABLE IF NOT EXISTS supervision.modele_surveillance (
    mesure_id bigserial PRIMARY KEY,
    date_mesure date NOT NULL,
    version text NOT NULL,
    indicateur text NOT NULL,
    valeur numeric(12, 5),
    statut text NOT NULL CHECK (statut IN ('ok', 'attention', 'alerte')),
    detail text
);
