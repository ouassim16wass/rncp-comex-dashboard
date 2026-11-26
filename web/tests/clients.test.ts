import { describe, expect, test } from "bun:test";
import { classer, ecartMois } from "../lib/comex";

describe("situation d'un client", () => {
  test("nouveau : facturé cette année seulement", () => {
    expect(classer(100, 0)).toBe("nouveau");
  });

  test("perdu : facturé l'an dernier seulement", () => {
    expect(classer(0, 100)).toBe("perdu");
  });

  test("hausse et baisse au seuil de 20 %", () => {
    expect(classer(120, 100)).toBe("hausse");
    expect(classer(119, 100)).toBe("stable");
    expect(classer(80, 100)).toBe("baisse");
    expect(classer(81, 100)).toBe("stable");
  });

  test("un client sans CA ni historique est stable", () => {
    expect(classer(0, 0)).toBe("stable");
  });

  test("écart en mois entre deux périodes", () => {
    expect(ecartMois(202607, 202605)).toBe(2);
    expect(ecartMois(202601, 202512)).toBe(1);
    expect(ecartMois(202607, 202607)).toBe(0);
  });
});
