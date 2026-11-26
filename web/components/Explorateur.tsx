import Link from "next/link";
import { BarreFiltres } from "./BarreFiltres";
import { Graphique } from "./charts/Graphique";
import { couleurPour, optionSeries } from "@/lib/graphiques";
import {
  cleCellule,
  formatterValeur,
  libelleColonne,
  limiterColonnes,
  pivoter,
  transformer,
  type Affichage,
} from "@/lib/analyse";
import { cubeParCle, type ParamsUrl, lireEtat, versUrl } from "@/lib/filtres";
import { cellules, periodes, totaux, valeursFiltres } from "@/lib/executer";
import { dimensionDe, mesureDe } from "@/lib/requete";

function teinte(valeur: number | null | undefined, maximum: number, affichage: Affichage): string | undefined {
  if (valeur === null || valeur === undefined || maximum === 0) return undefined;
  const force = Math.min(Math.abs(valeur) / maximum, 1) * 0.32;
  if (affichage === "variation") return valeur >= 0 ? `rgba(91,197,0,${force})` : `rgba(211,18,5,${force})`;
  return `rgba(0,138,224,${force})`;
}

export async function Explorateur({
  cleCube,
  params,
  base,
  titre,
  introduction,
  titreNiveau = "h1",
}: {
  cleCube: string;
  params: ParamsUrl;
  base: string;
  titre: string;
  introduction: string;
  titreNiveau?: "h1" | "h2";
}) {
  const cube = cubeParCle(cleCube);
  const etat = lireEtat(cube, params);
  const mesure = mesureDe(cube, etat.mesure);
  const temporel = etat.colonnes === "temps";
  const grain = cube.temps.type === "photo" ? "photo" : etat.grain;
  const [brut, totauxCube, listePeriodes, valeurs] = await Promise.all([
    cellules(cube, etat),
    totaux(cube, etat),
    periodes(cube, etat.axe),
    valeursFiltres(cube),
  ]);
  let affichage = etat.affichage;
  if ((affichage === "part" || affichage === "cumul") && !mesure.additive) affichage = "valeur";
  if ((affichage === "cumul" || affichage === "variation") && !temporel) affichage = "valeur";
  if (affichage === "variation" && cube.temps.type === "photo") affichage = "valeur";
  const sourceCellules = temporel ? brut : limiterColonnes(brut, mesure.additive, 12);
  const tableau = transformer(pivoter(sourceCellules, mesure.additive, etat.top), affichage, mesure.additive, grain);
  const brutTableau = pivoter(sourceCellules, mesure.additive, etat.top);
  const libCol = (c: string) => libelleColonne(c, grain, temporel);
  const categories = tableau.colonnes.map(libCol);
  const series = tableau.lignes.map((ligne, i) => ({
    nom: ligne,
    couleur: couleurPour(ligne, i),
    valeurs: tableau.colonnes.map((c) => tableau.valeurs.get(cleCellule(ligne, c)) ?? null),
  }));
  const modeAuto = affichage === "variation" || affichage === "cumul" ? "lignes" : mesure.additive ? "empile" : temporel ? "lignes" : "groupe";
  const mode = etat.graphique === "auto" ? modeAuto : etat.graphique;
  const formatGraphique = affichage === "part" || affichage === "variation" ? "pct" : mesure.format;
  const optionGraphique = optionSeries(
    categories,
    series.map((x) => ({
      nom: x.nom,
      valeurs: x.valeurs,
      couleur: x.couleur,
      type: mode === "lignes" ? ("line" as const) : ("bar" as const),
      empile: mode === "empile",
    })),
    { zoom: categories.length > 14, pct: affichage === "part" },
  );
  const maximum = Math.max(0, ...[...tableau.valeurs.values()].map((v) => Math.abs(v ?? 0)));
  const ligneDimension = etat.lignes !== "aucun" ? dimensionDe(cube, etat.lignes) : null;
  const filtresActifs = Object.entries(etat.filtres).filter(([, l]) => l.length);
  const exportUrl = `/api/export/${cube.cle}${versUrl("", etat).replace(/^\//, "")}`;
  const lienChoix = (modif: object) => versUrl(base, { ...etat, ...modif });
  const unite = mesure.format === "euro" ? "" : "";
  void unite;
  return (
    <>
      {titreNiveau === "h1" ? <h1>{titre}</h1> : <h3 className="sous-section">{titre}</h3>}
      <p className="sous-titre">{introduction}</p>
      <BarreFiltres cube={cube} etat={etat} periodes={listePeriodes} valeurs={valeurs} />
      {filtresActifs.length > 0 && (
        <div className="puces-filtres" aria-label="Filtres actifs">
          {filtresActifs.flatMap(([cle, liste]) =>
            liste.map((v) => (
              <Link
                key={`${cle}-${v}`}
                className="puce-filtre"
                href={lienChoix({ filtres: { ...etat.filtres, [cle]: liste.filter((x) => x !== v) } })}
                title="Retirer ce filtre"
              >
                {dimensionDe(cube, cle).libelle} : {v} ✕
              </Link>
            )),
          )}
        </div>
      )}
      <section className="grille-kpi" aria-label="Totaux sur la sélection">
        {cube.mesures.map((m) => (
          <Link key={m.cle} href={lienChoix({ mesure: m.cle, affichage: "valeur" })} className={`carte kpi-lien ${m.cle === etat.mesure ? "kpi-actif" : ""}`}>
            <p className="kpi-titre">{m.libelle}</p>
            <p className="kpi-valeur">{formatterValeur(totauxCube[m.cle], m.format, "valeur")}</p>
          </Link>
        ))}
      </section>
      <section className="carte" style={{ marginBottom: 18 }}>
        <div className="entete-carte">
          <h2>
            {mesure.libelle}
            {ligneDimension ? ` par ${ligneDimension.libelle.toLowerCase()}` : ""}
            {temporel ? "" : ` et ${dimensionDe(cube, etat.colonnes).libelle.toLowerCase()}`}
            {affichage === "part" ? " · répartition en %" : affichage === "cumul" ? " · cumul" : affichage === "variation" ? " · variation sur un an" : ""}
          </h2>
          <div className="segment" role="group" aria-label="Type de graphique">
            {(
              [
                ["auto", "Auto"],
                ["empile", "Empilé"],
                ["groupe", "Groupé"],
                ["lignes", "Lignes"],
              ] as const
            ).map(([cle, libelle]) => (
              <Link key={cle} href={lienChoix({ graphique: cle })} aria-pressed={etat.graphique === cle}>
                {libelle}
              </Link>
            ))}
          </div>
        </div>
        {mesure.aide && <p className="note" style={{ marginTop: -6 }}>{mesure.aide}</p>}
        {tableau.colonnes.length === 0 ? (
          <p>Aucune donnée pour cette sélection.</p>
        ) : (
          <Graphique option={optionGraphique} format={formatGraphique} titre={mesure.libelle} hauteur={340} />
        )}
        {tableau.masquees > 0 && <p className="note">{tableau.masquees} lignes supplémentaires masquées : cette mesure ne peut pas être additionnée.</p>}
      </section>
      <section className="carte">
        <div className="entete-carte">
          <h2>Tableau croisé</h2>
          <a className="bouton-lien" href={exportUrl}>
            Exporter en CSV
          </a>
        </div>
        <div className="pivot">
          <table>
            <thead>
              <tr>
                <th>{ligneDimension?.libelle ?? "Total"}</th>
                {tableau.colonnes.map((c) => (
                  <th key={c} className="num">
                    {libCol(c)}
                  </th>
                ))}
                {mesure.additive && affichage === "valeur" && <th className="num">Total</th>}
              </tr>
            </thead>
            <tbody>
              {tableau.lignes.map((ligne) => {
                const suivant = ligneDimension?.suivant;
                const descendre = ligneDimension && ligne !== "Autres" ? lienChoix({ lignes: suivant ?? etat.lignes, filtres: { ...etat.filtres, [etat.lignes]: [ligne] } }) : null;
                return (
                  <tr key={ligne}>
                    <td>
                      {descendre ? (
                        <Link href={descendre} title={suivant ? "Descendre dans le détail" : "Filtrer sur cette valeur"}>
                          {ligne}
                        </Link>
                      ) : (
                        ligne
                      )}
                    </td>
                    {tableau.colonnes.map((c) => {
                      const v = tableau.valeurs.get(cleCellule(ligne, c));
                      return (
                        <td key={c} className="num" style={{ background: teinte(v, maximum, affichage) }}>
                          {formatterValeur(v, mesure.format, affichage)}
                        </td>
                      );
                    })}
                    {mesure.additive && affichage === "valeur" && (
                      <td className="num total">{formatterValeur(tableau.totauxLignes.get(ligne), mesure.format, "valeur")}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {mesure.additive && affichage === "valeur" && tableau.lignes.length > 1 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  {tableau.colonnes.map((c) => (
                    <td key={c} className="num total">
                      {formatterValeur(brutTableau.totauxColonnes.get(c), mesure.format, "valeur")}
                    </td>
                  ))}
                  <td className="num total">
                    {formatterValeur([...brutTableau.totauxLignes.values()].reduce<number>((t, v) => t + (v ?? 0), 0), mesure.format, "valeur")}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="note">
          Cliquez sur une ligne pour descendre dans le détail (domaine, puis service, puis client). Les cases sont teintées selon leur poids.
        </p>
      </section>
    </>
  );
}
