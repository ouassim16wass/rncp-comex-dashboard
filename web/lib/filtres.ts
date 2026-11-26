import { CUBES, type AxeTemps, type Cube, type Grain } from "./cubes";
import type { Affichage } from "./analyse";
import type { Parametres } from "./requete";

export type ParamsUrl = Record<string, string | string[] | undefined>;

export type Etat = Parametres & {
  affichage: Affichage;
  top: number;
  graphique: "auto" | "empile" | "groupe" | "lignes";
};

const un = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export function lireEtat(cube: Cube, params: ParamsUrl): Etat {
  const mesure = cube.mesures.some((m) => m.cle === un(params.m)) ? (un(params.m) as string) : cube.mesureDefaut;
  const dims = cube.dimensions.map((d) => d.cle);
  const lignesBrut = un(params.l);
  const lignes = lignesBrut === "aucun" ? "aucun" : dims.includes(lignesBrut ?? "") ? (lignesBrut as string) : cube.lignesDefaut;
  const colonnesBrut = un(params.c);
  const colonnes = dims.includes(colonnesBrut ?? "") && colonnesBrut !== lignes ? (colonnesBrut as string) : "temps";
  const grain = (["mois", "trimestre", "annee"] as Grain[]).includes(un(params.g) as Grain) ? (un(params.g) as Grain) : "mois";
  const axe: AxeTemps = un(params.a) === "civil" ? "civil" : "sage";
  const affichage = (["valeur", "part", "cumul", "variation"] as Affichage[]).includes(un(params.v) as Affichage)
    ? (un(params.v) as Affichage)
    : "valeur";
  const top = Math.min(Math.max(Number(un(params.t) ?? 8) || 8, 1), 50);
  const graphique = (["empile", "groupe", "lignes"] as const).includes(un(params.gr) as "empile")
    ? (un(params.gr) as "empile" | "groupe" | "lignes")
    : "auto";
  const filtres: Record<string, string[]> = {};
  for (const d of dims) {
    const brut = un(params[`f_${d}`]);
    if (brut) filtres[d] = brut.split("|").filter(Boolean);
  }
  return {
    mesure,
    lignes,
    colonnes,
    grain,
    axe,
    filtres,
    du: un(params.du) || undefined,
    au: un(params.au) || undefined,
    inclure990: un(params.s990) === "1",
    affichage,
    top,
    graphique,
  };
}

export function versUrl(base: string, etat: Partial<Etat> & Record<string, unknown>, defauts?: Etat): string {
  const q = new URLSearchParams();
  const ajouter = (k: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  };
  ajouter("m", etat.mesure);
  ajouter("l", etat.lignes);
  ajouter("c", etat.colonnes !== "temps" ? etat.colonnes : undefined);
  ajouter("g", etat.grain && etat.grain !== "mois" ? etat.grain : undefined);
  ajouter("a", etat.axe === "civil" ? "civil" : undefined);
  ajouter("v", etat.affichage && etat.affichage !== "valeur" ? etat.affichage : undefined);
  ajouter("t", etat.top && etat.top !== 8 ? etat.top : undefined);
  ajouter("gr", etat.graphique && etat.graphique !== "auto" ? etat.graphique : undefined);
  ajouter("du", etat.du);
  ajouter("au", etat.au);
  ajouter("s990", etat.inclure990 ? "1" : undefined);
  for (const [cle, liste] of Object.entries(etat.filtres ?? {})) if (liste.length) q.set(`f_${cle}`, liste.join("|"));
  void defauts;
  const texte = q.toString();
  if (!texte) return base;
  const separateur = base.includes("?") ? (/[?&]$/.test(base) ? "" : "&") : "?";
  return `${base}${separateur}${texte}`;
}

export function cubeParCle(cle: string): Cube {
  const c = CUBES[cle];
  if (!c) throw new Error(`Cube inconnu : ${cle}`);
  return c;
}
