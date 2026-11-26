export type Format = "euro" | "nombre" | "pct" | "jours";

export type Dimension = { cle: string; libelle: string; sql: string; suivant?: string };

export type Mesure = {
  cle: string;
  libelle: string;
  sql: string;
  format: Format;
  additive: boolean;
  aide?: string;
};

export type Grain = "mois" | "trimestre" | "annee";
export type AxeTemps = "sage" | "civil";

export type Temps =
  | { type: "mensuel"; colonnes: Record<AxeTemps, Record<Grain, string>>; mois: Record<AxeTemps, string>; axes: AxeTemps[] }
  | { type: "photo"; colonne: string };

export type Cube = {
  cle: string;
  libelle: string;
  table: string;
  temps: Temps;
  dimensions: Dimension[];
  mesures: Mesure[];
  mesureDefaut: string;
  lignesDefaut: string;
};

const texte = (colonne: string) => `coalesce(${colonne}::text, 'Non renseigné')`;

export const FACTURATION: Cube = {
  cle: "facturation",
  libelle: "Facturation",
  table: "marts.cube_facturation",
  temps: {
    type: "mensuel",
    axes: ["sage", "civil"],
    mois: { sage: "periode", civil: "mois_civil" },
    colonnes: {
      sage: { mois: "periode", trimestre: "trimestre_sage", annee: "annee" },
      civil: { mois: "mois_civil", trimestre: "trimestre_civil", annee: "annee_civile" },
    },
  },
  dimensions: [
    { cle: "domaine", libelle: "Domaine", sql: texte("domaine"), suivant: "service" },
    { cle: "service", libelle: "Service", sql: texte("code_service"), suivant: "client" },
    { cle: "segment", libelle: "Segment de client", sql: texte("segment"), suivant: "client" },
    { cle: "famille", libelle: "Famille de produit", sql: texte("famille"), suivant: "article" },
    { cle: "article", libelle: "Article", sql: texte("article"), suivant: "client" },
    { cle: "commercial", libelle: "Commercial", sql: texte("commercial"), suivant: "client" },
    { cle: "client", libelle: "Client", sql: texte("client") },
    { cle: "build_run", libelle: "Build / Run", sql: texte("build_run") },
    { cle: "type_facture", libelle: "Type de pièce", sql: texte("type_facture") },
  ],
  mesures: [
    { cle: "ca_ht", libelle: "CA facturé HT", sql: "coalesce(sum(montant_ht) filter (where $CA), 0)", format: "euro", additive: true },
    {
      cle: "nb_factures",
      libelle: "Nombre de factures",
      sql: "count(distinct no_facture) filter (where $CA)",
      format: "nombre",
      additive: false,
    },
    {
      cle: "nb_clients",
      libelle: "Clients facturés",
      sql: "count(distinct tiers_id) filter (where $CA)",
      format: "nombre",
      additive: false,
    },
    {
      cle: "panier_moyen",
      libelle: "CA moyen par facture",
      sql: "sum(montant_ht) filter (where $CA) / nullif(count(distinct no_facture) filter (where $CA), 0)",
      format: "euro",
      additive: false,
    },
    {
      cle: "avoirs",
      libelle: "Avoirs",
      sql: "coalesce(sum(montant_ht) filter (where type_facture = 'AVO' and $CA), 0)",
      format: "euro",
      additive: true,
    },
  ],
  mesureDefaut: "ca_ht",
  lignesDefaut: "domaine",
};

const CA_COMPTABLE = "coalesce(-sum(montant_signe) filter (where classe like '1-%'), 0)";
const ACHATS = "coalesce(sum(montant_signe) filter (where classe like '2-%'), 0)";

export const MARGE: Cube = {
  cle: "marge",
  libelle: "Marge et résultat",
  table: "marts.cube_marge",
  temps: {
    type: "mensuel",
    axes: ["civil"],
    mois: { sage: "periode", civil: "periode" },
    colonnes: {
      sage: { mois: "periode", trimestre: "trimestre", annee: "annee" },
      civil: { mois: "periode", trimestre: "trimestre", annee: "annee" },
    },
  },
  dimensions: [
    { cle: "domaine", libelle: "Domaine", sql: texte("domaine"), suivant: "classe" },
    { cle: "classe", libelle: "Classe de comptes", sql: texte("classe"), suivant: "famille_charge" },
    { cle: "famille_charge", libelle: "Famille de charge", sql: texte("famille_charge") },
    { cle: "build_run", libelle: "Build / Run", sql: texte("build_run") },
    { cle: "type_piece", libelle: "Type de pièce", sql: texte("type_piece") },
    { cle: "section", libelle: "Section analytique", sql: texte("section_analytique") },
    { cle: "client", libelle: "Tiers", sql: texte("client") },
  ],
  mesures: [
    { cle: "ca_comptable", libelle: "CA comptable", sql: CA_COMPTABLE, format: "euro", additive: true },
    { cle: "achats", libelle: "Achats", sql: ACHATS, format: "euro", additive: true },
    {
      cle: "marge_brute",
      libelle: "Marge brute",
      sql: `${CA_COMPTABLE} - ${ACHATS}`,
      format: "euro",
      additive: true,
      aide: "CA comptable moins achats (classe 2). Définition des charges directes à confirmer.",
    },
    {
      cle: "taux_marge",
      libelle: "Taux de marge brute",
      sql: `(${CA_COMPTABLE} - ${ACHATS}) / nullif(${CA_COMPTABLE}, 0)`,
      format: "pct",
      additive: false,
    },
    {
      cle: "charges",
      libelle: "Charges (hors CA)",
      sql: "coalesce(sum(montant_signe) filter (where classe not like '1-%'), 0)",
      format: "euro",
      additive: true,
    },
    {
      cle: "solde",
      libelle: "Solde produits moins charges",
      sql: "coalesce(-sum(montant_signe), 0)",
      format: "euro",
      additive: true,
    },
    { cle: "nb_ecritures", libelle: "Écritures", sql: "count(*)", format: "nombre", additive: true },
  ],
  mesureDefaut: "marge_brute",
  lignesDefaut: "domaine",
};

export const ECHEANCES: Cube = {
  cle: "echeances",
  libelle: "Trésorerie",
  table: "marts.cube_echeances",
  temps: { type: "photo", colonne: "date_photo" },
  dimensions: [
    { cle: "sens", libelle: "Créances ou dettes", sql: texte("sens") },
    { cle: "tranche", libelle: "Tranche de retard", sql: texte("tranche_retard") },
    { cle: "segment", libelle: "Segment de client", sql: texte("segment"), suivant: "client" },
    { cle: "client", libelle: "Tiers", sql: texte("client") },
  ],
  mesures: [
    { cle: "solde", libelle: "Solde ouvert", sql: "coalesce(sum(solde), 0)", format: "euro", additive: true },
    {
      cle: "solde_echu",
      libelle: "Solde échu",
      sql: "coalesce(sum(solde) filter (where jours_retard >= 0), 0)",
      format: "euro",
      additive: true,
    },
    { cle: "nb_pieces", libelle: "Pièces ouvertes", sql: "count(*)", format: "nombre", additive: true },
    { cle: "nb_tiers", libelle: "Tiers concernés", sql: "count(distinct tiers_id)", format: "nombre", additive: false },
    {
      cle: "retard_moyen",
      libelle: "Retard moyen des pièces échues",
      sql: "avg(jours_retard) filter (where jours_retard >= 0)",
      format: "jours",
      additive: false,
    },
  ],
  mesureDefaut: "solde",
  lignesDefaut: "tranche",
};

const GAGNEE = "count(*) filter (where motif_cloture like 'Gagnée%')";

export const PIPELINE: Cube = {
  cle: "pipeline",
  libelle: "Pipeline commercial",
  table: "marts.cube_pipeline",
  temps: { type: "photo", colonne: "date_photo" },
  dimensions: [
    { cle: "domaine", libelle: "Domaine", sql: texte("domaine"), suivant: "commercial" },
    { cle: "etape", libelle: "Étape", sql: texte("etape") },
    { cle: "motif", libelle: "Motif de clôture", sql: texte("motif_cloture") },
    { cle: "type_affaire", libelle: "Type d'affaire", sql: texte("type_affaire") },
    { cle: "commercial", libelle: "Commercial", sql: texte("commercial"), suivant: "client" },
    { cle: "segment", libelle: "Segment de client", sql: texte("segment"), suivant: "client" },
    { cle: "client", libelle: "Compte", sql: texte("client") },
    { cle: "gagnee", libelle: "Issue", sql: "case when est_gagnee then 'Gagnée' else 'Non gagnée' end" },
  ],
  mesures: [
    { cle: "montant", libelle: "Montant du pipeline", sql: "coalesce(sum(montant_global), 0)", format: "euro", additive: true },
    { cle: "nb", libelle: "Opportunités", sql: "count(*)", format: "nombre", additive: true },
    {
      cle: "montant_gagne",
      libelle: "Montant gagné",
      sql: "coalesce(sum(montant_global) filter (where est_gagnee), 0)",
      format: "euro",
      additive: true,
    },
    {
      cle: "win_ratio",
      libelle: "Taux de gain (gagnées sur gagnées et perdues)",
      sql: `${GAGNEE}::numeric / nullif(${GAGNEE} + count(*) filter (where motif_cloture = 'Perdue'), 0)`,
      format: "pct",
      additive: false,
    },
    { cle: "montant_moyen", libelle: "Montant moyen", sql: "avg(montant_global)", format: "euro", additive: false },
  ],
  mesureDefaut: "montant",
  lignesDefaut: "etape",
};

export const CUBES: Record<string, Cube> = {
  facturation: FACTURATION,
  marge: MARGE,
  echeances: ECHEANCES,
  pipeline: PIPELINE,
};
