import type { Format, Grain } from "./cubes";
import { euros, libellePeriode, pct } from "./format";

export type Cellule = { ligne: string; colonne: string; valeur: number | null };

export type Affichage = "valeur" | "part" | "cumul" | "variation";

export type Tableau = {
  lignes: string[];
  colonnes: string[];
  valeurs: Map<string, number | null>;
  totauxLignes: Map<string, number | null>;
  totauxColonnes: Map<string, number | null>;
  masquees: number;
};

export const cleCellule = (ligne: string, colonne: string) => `${ligne}\u0000${colonne}`;

export function pivoter(cellules: Cellule[], additive: boolean, top: number): Tableau {
  const colonnes = [...new Set(cellules.map((c) => c.colonne))].sort();
  const totalParLigne = new Map<string, number>();
  for (const c of cellules) totalParLigne.set(c.ligne, (totalParLigne.get(c.ligne) ?? 0) + Math.abs(c.valeur ?? 0));
  const classees = [...totalParLigne.entries()].sort((a, b) => b[1] - a[1]).map(([ligne]) => ligne);
  const gardees = top > 0 ? classees.slice(0, top) : classees;
  const reste = classees.slice(gardees.length);
  const valeurs = new Map<string, number | null>();
  for (const c of cellules) {
    if (gardees.includes(c.ligne)) valeurs.set(cleCellule(c.ligne, c.colonne), c.valeur);
  }
  const lignes = [...gardees];
  let masquees = 0;
  if (reste.length) {
    if (additive) {
      lignes.push("Autres");
      for (const col of colonnes) {
        const somme = cellules.filter((c) => c.colonne === col && reste.includes(c.ligne)).reduce((t, c) => t + (c.valeur ?? 0), 0);
        valeurs.set(cleCellule("Autres", col), somme);
      }
    } else {
      masquees = reste.length;
    }
  }
  const totauxLignes = new Map<string, number | null>();
  const totauxColonnes = new Map<string, number | null>();
  if (additive) {
    for (const l of lignes) totauxLignes.set(l, colonnes.reduce((t, c) => t + (valeurs.get(cleCellule(l, c)) ?? 0), 0));
    for (const c of colonnes) totauxColonnes.set(c, lignes.reduce((t, l) => t + (valeurs.get(cleCellule(l, c)) ?? 0), 0));
  }
  return { lignes, colonnes, valeurs, totauxLignes, totauxColonnes, masquees };
}

export function limiterColonnes(cellules: Cellule[], additive: boolean, maximum: number): Cellule[] {
  const totaux = new Map<string, number>();
  for (const c of cellules) totaux.set(c.colonne, (totaux.get(c.colonne) ?? 0) + Math.abs(c.valeur ?? 0));
  const classees = [...totaux.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  if (classees.length <= maximum) return cellules;
  const gardees = new Set(classees.slice(0, maximum));
  const resultat = cellules.filter((c) => gardees.has(c.colonne));
  if (!additive) return resultat;
  const autres = new Map<string, number>();
  for (const c of cellules) if (!gardees.has(c.colonne)) autres.set(c.ligne, (autres.get(c.ligne) ?? 0) + (c.valeur ?? 0));
  for (const [ligne, valeur] of autres) resultat.push({ ligne, colonne: "Autres", valeur });
  return resultat;
}

export function precedente(colonne: string, grain: Grain | "photo"): string | null {
  if (grain === "mois" && /^\d{6}$/.test(colonne)) return String(Number(colonne) - 100);
  if (grain === "trimestre" && /^\d{5}$/.test(colonne)) return String(Number(colonne) - 10);
  if (grain === "annee" && /^\d{4}$/.test(colonne)) return String(Number(colonne) - 1);
  return null;
}

export function transformer(t: Tableau, affichage: Affichage, additive: boolean, grain: Grain | "photo"): Tableau {
  if (affichage === "valeur") return t;
  const valeurs = new Map<string, number | null>();
  if (affichage === "part" && additive) {
    for (const l of t.lignes)
      for (const c of t.colonnes) {
        const v = t.valeurs.get(cleCellule(l, c));
        const total = t.totauxColonnes.get(c) ?? 0;
        valeurs.set(cleCellule(l, c), v === null || v === undefined || total === 0 ? null : v / total);
      }
    return { ...t, valeurs, totauxLignes: new Map(), totauxColonnes: new Map() };
  }
  if (affichage === "cumul" && additive) {
    for (const l of t.lignes) {
      let cumul = 0;
      for (const c of t.colonnes) {
        cumul += t.valeurs.get(cleCellule(l, c)) ?? 0;
        valeurs.set(cleCellule(l, c), cumul);
      }
    }
    return { ...t, valeurs, totauxLignes: new Map(), totauxColonnes: new Map() };
  }
  if (affichage === "variation") {
    for (const l of t.lignes)
      for (const c of t.colonnes) {
        const p = precedente(c, grain);
        const actuel = t.valeurs.get(cleCellule(l, c));
        const avant = p ? t.valeurs.get(cleCellule(l, p)) : null;
        valeurs.set(cleCellule(l, c), actuel === null || actuel === undefined || !avant ? null : actuel / avant - 1);
      }
    return { ...t, valeurs, totauxLignes: new Map(), totauxColonnes: new Map() };
  }
  return t;
}

export function formatterValeur(v: number | null | undefined, format: Format, affichage: Affichage): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (affichage === "part") return pct(v, 1);
  if (affichage === "variation") return `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
  if (format === "euro") return euros(v);
  if (format === "pct") return pct(v, 1);
  if (format === "jours") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} j`;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export function libelleColonne(colonne: string, grain: Grain | "photo", temporelle: boolean): string {
  if (!temporelle) return colonne;
  if (grain === "mois" && /^\d{6}$/.test(colonne)) return libellePeriode(Number(colonne));
  if (grain === "trimestre" && /^\d{5}$/.test(colonne)) return `T${colonne.slice(4)} ${colonne.slice(0, 4)}`;
  if (grain === "annee") return colonne;
  if (/^\d{4}-\d{2}-\d{2}$/.test(colonne)) return new Date(colonne).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  return colonne;
}

export function enCsv(t: Tableau, libelleLigne: string, libelleCol: (c: string) => string): string {
  const echapper = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const entete = [libelleLigne, ...t.colonnes.map(libelleCol)].map(echapper).join(";");
  const corps = t.lignes.map((l) =>
    [echapper(l), ...t.colonnes.map((c) => String(t.valeurs.get(cleCellule(l, c)) ?? "").replace(".", ","))].join(";"),
  );
  return [entete, ...corps].join("\n");
}
