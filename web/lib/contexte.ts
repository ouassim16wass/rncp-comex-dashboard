import { moisDisponibles, type FiltreComex } from "./comex";
import { fenetre, lireMode, type Fenetre, type Mode } from "./periode";
import type { ParamsUrl } from "./filtres";

export type Contexte = {
  mois: number[];
  premierMois: number;
  dernierMois: number;
  fin: number;
  mode: Mode;
  f: Fenetre;
  comparable: boolean;
  segments: string[];
  domaines: string[];
  filtre: FiltreComex;
};

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function lireContexte(params: ParamsUrl): Promise<Contexte> {
  const tous = await moisDisponibles();
  const complets = tous.slice(0, -1);
  const demande = Number(un(params.p));
  const fin = complets.includes(demande) ? demande : complets[complets.length - 1];
  const mode = lireMode(un(params.mode));
  const f = fenetre(fin, mode);
  const segments = (un(params.seg) ?? "").split("|").filter(Boolean);
  const domaines = (un(params.dom) ?? "").split("|").filter(Boolean);
  return {
    mois: complets,
    premierMois: tous[0],
    dernierMois: tous[tous.length - 1],
    fin,
    mode,
    f,
    comparable: f.debutN1 >= tous[0],
    segments,
    domaines,
    filtre: { ...(segments.length ? { segments } : {}), ...(domaines.length ? { domaines } : {}) },
  };
}
