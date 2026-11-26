import { describe, expect, test } from "bun:test";
import { construireAlertes, type EntreeAlertes } from "../lib/alertes";
import { fenetre, moinsMois } from "../lib/periode";

const base: EntreeAlertes = {
  ca: 100,
  caN1: 100,
  libelleFenetre: "12 mois glissants",
  domaines: [],
  top1: 0.05,
  top5: 0.2,
  partGroupe: 0.5,
  perdus: { nb: 0, ca: 0 },
  nouveaux: { nb: 0, ca: 0 },
  creances: { total: 100, echu30: 5, photo: "2026-11-20" },
  pipelinePhoto: "2026-11-20",
  ecartComptable: 0.02,
  risque: null,
  aujourdhui: new Date("2026-11-24"),
};

describe("alertes COMEX", () => {
  test("situation saine : aucune alerte", () => {
    expect(construireAlertes(base)).toEqual([]);
  });

  test("baisse du CA", () => {
    const a = construireAlertes({ ...base, ca: 90 });
    expect(a[0].niveau).toBe("alerte");
    expect(a[0].titre).toContain("baisse");
  });

  test("hausse du CA est une bonne nouvelle", () => {
    expect(construireAlertes({ ...base, ca: 120 })[0].niveau).toBe("positif");
  });

  test("domaine en forte baisse et assez gros", () => {
    const a = construireAlertes({ ...base, domaines: [{ membre: "D3", ca: 5, caN1: 20 }] });
    expect(a.some((x) => x.titre.includes("D3"))).toBe(true);
  });

  test("un petit domaine en baisse ne déclenche rien", () => {
    const a = construireAlertes({ ...base, domaines: [{ membre: "HD", ca: 0.1, caN1: 1 }] });
    expect(a).toEqual([]);
  });

  test("concentration", () => {
    expect(construireAlertes({ ...base, top5: 0.55 }).some((x) => x.titre.includes("concentration"))).toBe(true);
  });

  test("créances anciennes et données périmées", () => {
    const a = construireAlertes({ ...base, creances: { total: 100, echu30: 40, photo: "2026-10-12" } });
    expect(a.some((x) => x.titre.includes("plus de 30 jours"))).toBe(true);
    expect(a.some((x) => x.titre.includes("Créances arrêtées"))).toBe(true);
  });

  test("les alertes sont triées par gravité", () => {
    const a = construireAlertes({ ...base, ca: 120, top1: 0.3, creances: { total: 100, echu30: 40, photo: "2026-11-20" } });
    expect(a.map((x) => x.niveau)).toEqual(["alerte", "attention", "positif"]);
  });
});

describe("alertes sur le modèle de risque", () => {
  test("aucun client élevé mais des clients moyens", () => {
    const a = construireAlertes({ ...base, risque: { eleves: 0, moyens: 81, partCA: 0, partCAMoyen: 0.02 } });
    expect(a.some((x) => x.titre.includes("risque de départ moyen"))).toBe(true);
    expect(a.some((x) => x.titre.includes("élevé"))).toBe(false);
  });

  test("clients élevés exposant beaucoup de CA", () => {
    const a = construireAlertes({ ...base, risque: { eleves: 10, moyens: 0, partCA: 0.08, partCAMoyen: 0 } });
    expect(a[0].niveau).toBe("alerte");
  });

  test("dérive du modèle signalée seulement hors du vert", () => {
    expect(construireAlertes({ ...base, derive: { psiMax: 0.05, statut: "ok" } })).toEqual([]);
    const a = construireAlertes({ ...base, derive: { psiMax: 1.1, statut: "alerte" } });
    expect(a[0].titre).toContain("dérive");
  });
});

describe("fenêtres de comparaison", () => {
  test("arithmétique des mois", () => {
    expect(moinsMois(202601, 1)).toBe(202512);
    expect(moinsMois(202607, 11)).toBe(202508);
    expect(moinsMois(202607, 12)).toBe(202507);
  });

  test("cumul depuis janvier", () => {
    expect(fenetre(202607, "ytd")).toEqual({ mode: "ytd", fin: 202607, debut: 202601, finN1: 202507, debutN1: 202501 });
  });

  test("12 mois glissants", () => {
    expect(fenetre(202607, "12m")).toEqual({ mode: "12m", fin: 202607, debut: 202508, finN1: 202507, debutN1: 202408 });
  });

  test("mois seul", () => {
    expect(fenetre(202607, "mois")).toEqual({ mode: "mois", fin: 202607, debut: 202607, finN1: 202507, debutN1: 202507 });
  });
});
