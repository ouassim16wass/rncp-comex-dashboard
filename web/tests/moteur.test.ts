import { describe, expect, test } from "bun:test";
import { cleCellule, pivoter, precedente, transformer } from "../lib/analyse";
import { FACTURATION, MARGE, PIPELINE } from "../lib/cubes";
import { lireEtat } from "../lib/filtres";
import { construireRequete, construireTotaux, type Parametres } from "../lib/requete";

const base: Parametres = {
  mesure: "ca_ht",
  lignes: "domaine",
  colonnes: "temps",
  grain: "mois",
  axe: "sage",
  filtres: {},
  inclure990: false,
};

describe("construction des requêtes", () => {
  test("agrège par ligne et par mois Sage", () => {
    const r = construireRequete(FACTURATION, base);
    expect(r.sql).toContain("periode::text as colonne");
    expect(r.sql).toContain("not hors_ca");
    expect(r.valeurs).toEqual([]);
  });

  test("le service 990 peut être inclus", () => {
    const r = construireRequete(FACTURATION, { ...base, inclure990: true });
    expect(r.sql).not.toContain("not hors_ca");
  });

  test("le grain et l'axe changent la colonne de temps", () => {
    expect(construireRequete(FACTURATION, { ...base, grain: "trimestre" }).sql).toContain("trimestre_sage::text");
    expect(construireRequete(FACTURATION, { ...base, grain: "annee", axe: "civil" }).sql).toContain("annee_civile::text");
  });

  test("les filtres et les bornes passent par des paramètres", () => {
    const r = construireRequete(FACTURATION, { ...base, filtres: { domaine: ["D1", "D2"] }, du: "202601", au: "202607" });
    expect(r.valeurs).toEqual([["D1", "D2"], 202601, 202607]);
    expect(r.sql).toContain("= any($1::text[])");
    expect(r.sql).toContain("periode >= $2");
    expect(r.sql).not.toContain("D1");
  });

  test("un axe inconnu est refusé", () => {
    expect(() => construireRequete(FACTURATION, { ...base, lignes: "x; drop table" })).toThrow();
    expect(() => construireRequete(FACTURATION, { ...base, filtres: { "1=1 --": ["a"] } })).toThrow();
    expect(() => construireRequete(FACTURATION, { ...base, mesure: "inconnue" })).toThrow();
  });

  test("le croisement de deux axes remplace le temps", () => {
    const r = construireRequete(FACTURATION, { ...base, colonnes: "segment" });
    expect(r.sql).toContain("as colonne");
    expect(r.sql).not.toContain("periode::text");
  });

  test("cubes à photo : bornes de date", () => {
    const r = construireRequete(PIPELINE, { ...base, mesure: "montant", lignes: "etape", du: "2026-04-01" });
    expect(r.sql).toContain("date_photo >= $1::date");
    expect(r.valeurs).toEqual(["2026-04-01"]);
  });

  test("totaux : toutes les mesures du cube", () => {
    const r = construireTotaux(MARGE, { ...base, mesure: "marge_brute" });
    expect(r.sql).toContain("as marge_brute");
    expect(r.sql).toContain("as taux_marge");
  });
});

describe("pivot et transformations", () => {
  const cellules = [
    { ligne: "A", colonne: "202601", valeur: 60 },
    { ligne: "A", colonne: "202602", valeur: 80 },
    { ligne: "B", colonne: "202601", valeur: 30 },
    { ligne: "B", colonne: "202602", valeur: 20 },
    { ligne: "C", colonne: "202601", valeur: 10 },
  ];

  test("classe par total et regroupe le reste en Autres", () => {
    const t = pivoter(cellules, true, 2);
    expect(t.lignes).toEqual(["A", "B", "Autres"]);
    expect(t.valeurs.get(cleCellule("Autres", "202601"))).toBe(10);
    expect(t.totauxColonnes.get("202601")).toBe(100);
  });

  test("une mesure non additive masque le reste sans l'agréger", () => {
    const t = pivoter(cellules, false, 2);
    expect(t.lignes).toEqual(["A", "B"]);
    expect(t.masquees).toBe(1);
  });

  test("part : chaque colonne totalise 100 %", () => {
    const t = transformer(pivoter(cellules, true, 0), "part", true, "mois");
    const somme = t.lignes.reduce((s, l) => s + (t.valeurs.get(cleCellule(l, "202601")) ?? 0), 0);
    expect(somme).toBeCloseTo(1);
  });

  test("cumul le long du temps", () => {
    const t = transformer(pivoter(cellules, true, 0), "cumul", true, "mois");
    expect(t.valeurs.get(cleCellule("A", "202602"))).toBe(140);
  });

  test("variation sur un an", () => {
    const annuel = pivoter(
      [
        { ligne: "A", colonne: "202501", valeur: 50 },
        { ligne: "A", colonne: "202601", valeur: 60 },
      ],
      true,
      0,
    );
    const t = transformer(annuel, "variation", true, "mois");
    expect(t.valeurs.get(cleCellule("A", "202601"))).toBeCloseTo(0.2);
    expect(t.valeurs.get(cleCellule("A", "202501"))).toBeNull();
    expect(precedente("20261", "trimestre")).toBe("20251");
    expect(precedente("2026", "annee")).toBe("2025");
  });
});

describe("lecture de l'URL", () => {
  test("valeurs par défaut et rejet des valeurs invalides", () => {
    const e = lireEtat(FACTURATION, { m: "n'importe quoi", l: "x", g: "semaine" });
    expect(e.mesure).toBe("ca_ht");
    expect(e.lignes).toBe("domaine");
    expect(e.grain).toBe("mois");
  });

  test("filtres multiples", () => {
    const e = lireEtat(FACTURATION, { f_domaine: "D1|D2", f_inconnu: "x", c: "segment" });
    expect(e.filtres).toEqual({ domaine: ["D1", "D2"] });
    expect(e.colonnes).toBe("segment");
  });
});
