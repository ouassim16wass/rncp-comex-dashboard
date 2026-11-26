import type { AxeTemps, Cube, Grain, Mesure } from "./cubes";

export type Filtres = Record<string, string[]>;

export type Parametres = {
  mesure: string;
  lignes: string;
  colonnes: string;
  grain: Grain;
  axe: AxeTemps;
  filtres: Filtres;
  du?: string;
  au?: string;
  inclure990: boolean;
};

export type Requete = { sql: string; valeurs: unknown[] };

export function mesureDe(cube: Cube, cle: string): Mesure {
  const m = cube.mesures.find((x) => x.cle === cle);
  if (!m) throw new Error(`Mesure inconnue : ${cle}`);
  return m;
}

export function dimensionDe(cube: Cube, cle: string) {
  const d = cube.dimensions.find((x) => x.cle === cle);
  if (!d) throw new Error(`Axe inconnu : ${cle}`);
  return d;
}

export function expressionMesure(cube: Cube, mesure: Mesure, inclure990: boolean): string {
  const ca = cube.cle === "facturation" && !inclure990 ? "not hors_ca" : "true";
  return mesure.sql.replaceAll("$CA", ca);
}

export function expressionTemps(cube: Cube, grain: Grain, axe: AxeTemps): string {
  if (cube.temps.type === "photo") return `to_char(${cube.temps.colonne}, 'YYYY-MM-DD')`;
  const axeValide = cube.temps.axes.includes(axe) ? axe : cube.temps.axes[0];
  return `${cube.temps.colonnes[axeValide][grain]}::text`;
}

function conditions(cube: Cube, p: Parametres, valeurs: unknown[]): string[] {
  const where: string[] = [];
  for (const [cle, liste] of Object.entries(p.filtres)) {
    if (!liste.length) continue;
    const dimension = dimensionDe(cube, cle);
    valeurs.push(liste);
    where.push(`(${dimension.sql}) = any($${valeurs.length}::text[])`);
  }
  if (cube.temps.type === "mensuel") {
    const axe = cube.temps.axes.includes(p.axe) ? p.axe : cube.temps.axes[0];
    const colonne = cube.temps.mois[axe];
    if (p.du) {
      valeurs.push(Number(p.du));
      where.push(`${colonne} >= $${valeurs.length}`);
    }
    if (p.au) {
      valeurs.push(Number(p.au));
      where.push(`${colonne} <= $${valeurs.length}`);
    }
  } else {
    if (p.du) {
      valeurs.push(p.du);
      where.push(`${cube.temps.colonne} >= $${valeurs.length}::date`);
    }
    if (p.au) {
      valeurs.push(p.au);
      where.push(`${cube.temps.colonne} <= $${valeurs.length}::date`);
    }
  }
  return where;
}

export function construireRequete(cube: Cube, p: Parametres): Requete {
  const valeurs: unknown[] = [];
  const mesure = mesureDe(cube, p.mesure);
  const ligne = p.lignes && p.lignes !== "aucun" ? dimensionDe(cube, p.lignes).sql : "'Total'";
  const colonne = p.colonnes === "temps" ? expressionTemps(cube, p.grain, p.axe) : dimensionDe(cube, p.colonnes).sql;
  const where = conditions(cube, p, valeurs);
  const sql = `select ${ligne} as ligne, ${colonne} as colonne, ${expressionMesure(cube, mesure, p.inclure990)}::float8 as valeur
from ${cube.table}${where.length ? `\nwhere ${where.join("\n  and ")}` : ""}
group by 1, 2
order by 1, 2`;
  return { sql, valeurs };
}

export function construireTotaux(cube: Cube, p: Parametres): Requete {
  const valeurs: unknown[] = [];
  const where = conditions(cube, p, valeurs);
  const colonnes = cube.mesures.map((m) => `${expressionMesure(cube, m, p.inclure990)}::float8 as ${m.cle}`).join(",\n       ");
  const sql = `select ${colonnes}\nfrom ${cube.table}${where.length ? `\nwhere ${where.join("\n  and ")}` : ""}`;
  return { sql, valeurs };
}

export function construireValeurs(cube: Cube, cle: string): Requete {
  const dimension = dimensionDe(cube, cle);
  return {
    sql: `select ${dimension.sql} as valeur, count(*)::int as n from ${cube.table} group by 1 order by 2 desc, 1`,
    valeurs: [],
  };
}

export function construirePeriodes(cube: Cube, axe: AxeTemps): Requete {
  if (cube.temps.type === "photo") {
    return { sql: `select distinct to_char(${cube.temps.colonne}, 'YYYY-MM-DD') as valeur from ${cube.table} order by 1`, valeurs: [] };
  }
  const colonne = cube.temps.mois[cube.temps.axes.includes(axe) ? axe : cube.temps.axes[0]];
  return { sql: `select distinct ${colonne}::text as valeur from ${cube.table} order by 1`, valeurs: [] };
}
