import type { AxeTemps, Cube } from "./cubes";
import { requete } from "./db";
import { construirePeriodes, construireRequete, construireTotaux, construireValeurs, type Parametres } from "./requete";
import type { Cellule } from "./analyse";

const DUREE = 60_000;
const memoire = new Map<string, { instant: number; valeur: unknown }>();

async function memoriser<T>(cle: string, charger: () => Promise<T>): Promise<T> {
  const present = memoire.get(cle);
  if (present && Date.now() - present.instant < DUREE) return present.valeur as T;
  const valeur = await charger();
  memoire.set(cle, { instant: Date.now(), valeur });
  return valeur;
}

export async function cellules(cube: Cube, p: Parametres): Promise<Cellule[]> {
  const r = construireRequete(cube, p);
  return requete<Cellule>(r.sql, r.valeurs);
}

export async function totaux(cube: Cube, p: Parametres): Promise<Record<string, number | null>> {
  const r = construireTotaux(cube, p);
  const lignes = await requete<Record<string, number | null>>(r.sql, r.valeurs);
  return lignes[0] ?? {};
}

export type ValeurFiltre = { valeur: string; n: number };

export async function valeursFiltres(cube: Cube): Promise<Record<string, ValeurFiltre[]>> {
  return memoriser(`valeurs:${cube.cle}`, async () => {
    const resultats = await Promise.all(
      cube.dimensions.map(async (d) => {
        const r = construireValeurs(cube, d.cle);
        const lignes = await requete<ValeurFiltre>(r.sql, r.valeurs);
        return [d.cle, lignes.slice(0, 400)] as const;
      }),
    );
    return Object.fromEntries(resultats);
  });
}

export async function periodes(cube: Cube, axe: AxeTemps): Promise<string[]> {
  return memoriser(`periodes:${cube.cle}:${axe}`, async () => {
    const r = construirePeriodes(cube, axe);
    const lignes = await requete<{ valeur: string }>(r.sql, r.valeurs);
    return lignes.map((l) => l.valeur);
  });
}
