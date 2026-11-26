import { cleCellule, enCsv, libelleColonne, limiterColonnes, pivoter } from "@/lib/analyse";
import { CUBES } from "@/lib/cubes";
import { cellules } from "@/lib/executer";
import { lireEtat } from "@/lib/filtres";
import { dimensionDe, mesureDe } from "@/lib/requete";

export const dynamic = "force-dynamic";

export async function GET(requete: Request, { params }: { params: Promise<{ cube: string }> }) {
  const { cube: cle } = await params;
  const cube = CUBES[cle];
  if (!cube) return new Response("Cube inconnu", { status: 404 });
  const url = new URL(requete.url);
  const etat = lireEtat(cube, Object.fromEntries(url.searchParams.entries()));
  const mesure = mesureDe(cube, etat.mesure);
  const temporel = etat.colonnes === "temps";
  const grain = cube.temps.type === "photo" ? "photo" : etat.grain;
  const brut = await cellules(cube, etat);
  const source = temporel ? brut : limiterColonnes(brut, mesure.additive, 50);
  const tableau = pivoter(source, mesure.additive, 0);
  const libelleLigne = etat.lignes !== "aucun" ? dimensionDe(cube, etat.lignes).libelle : "Total";
  const csv = enCsv(tableau, `${libelleLigne} (${mesure.libelle})`, (c) => libelleColonne(c, grain, temporel));
  void cleCellule;
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${cube.cle}.csv"`,
    },
  });
}
