export type Mode = "ytd" | "12m" | "mois";

export type Fenetre = {
  mode: Mode;
  fin: number;
  debut: number;
  finN1: number;
  debutN1: number;
};

export function moinsMois(periode: number, n: number): number {
  const annee = Math.floor(periode / 100);
  const mois = periode % 100;
  const index = annee * 12 + (mois - 1) - n;
  return Math.floor(index / 12) * 100 + (index % 12) + 1;
}

export function fenetre(fin: number, mode: Mode): Fenetre {
  const debut = mode === "ytd" ? Math.floor(fin / 100) * 100 + 1 : mode === "12m" ? moinsMois(fin, 11) : fin;
  return { mode, fin, debut, finN1: moinsMois(fin, 12), debutN1: moinsMois(debut, 12) };
}

export function libelleMode(mode: Mode): string {
  return mode === "ytd" ? "cumul depuis janvier" : mode === "12m" ? "12 mois glissants" : "mois";
}

export function lireMode(valeur: string | undefined): Mode {
  return valeur === "12m" || valeur === "mois" ? valeur : "ytd";
}
