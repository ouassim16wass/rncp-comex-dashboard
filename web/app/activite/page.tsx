import { Graphique } from "@/components/charts/Graphique";
import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { TableauDonnees, type Ligne } from "@/components/ui/TableauDonnees";
import { Tuile } from "@/components/ui/Tuile";
import { buildRunParDomaine, commerciaux, famillesParDomaine, serieDomaineMensuelle } from "@/lib/analyses";
import { kpis, pont } from "@/lib/comex";
import { lireContexte } from "@/lib/contexte";
import type { ParamsUrl } from "@/lib/filtres";
import { euros, libellePeriode, pct, variation } from "@/lib/format";
import { couleurPour, optionBarresHorizontales, optionDonut, optionSeries, optionTreemap } from "@/lib/graphiques";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const ctx = await lireContexte(await searchParams);
  const { f, comparable, filtre } = ctx;
  const [k, serie, domaines, famillesPont, familles, commerciauxListe, runDomaine] = await Promise.all([
    kpis(f, filtre),
    serieDomaineMensuelle({ segments: filtre.segments }),
    pont(f, "domaine", filtre),
    pont(f, "famille", filtre),
    famillesParDomaine(f, filtre),
    commerciaux(f, filtre),
    buildRunParDomaine(f, filtre),
  ]);
  const periodes = [...new Set(serie.map((s) => s.periode))].filter((p) => ctx.mois.includes(p)).sort();
  const noms = [...new Set(serie.map((s) => s.domaine))];
  const optionTemps = optionSeries(
    periodes.map(libellePeriode),
    noms.map((d, i) => ({ nom: d, valeurs: periodes.map((p) => serie.find((s) => s.periode === p && s.domaine === d)?.ca ?? 0), couleur: couleurPour(d, i), empile: true })),
    { zoom: true },
  );
  const totalDom = domaines.reduce((t, d) => t + d.ca, 0) || 1;
  const topFamilles = [...famillesPont].sort((a, b) => b.ca - a.ca).slice(0, 10);
  const topComm = commerciauxListe.slice(0, 10);
  const domainesRun = [...new Set(runDomaine.map((r) => r.domaine))].sort();
  const valeurRun = (d: string, m: string) => runDomaine.filter((r) => r.domaine === d && r.mode === m).reduce((t, r) => t + r.ca, 0);
  const optionRun = optionSeries(
    domainesRun,
    [
      { nom: "Run (récurrent)", valeurs: domainesRun.map((d) => valeurRun(d, "RUN")), couleur: "#141c52", empile: true },
      { nom: "Build (projets)", valeurs: domainesRun.map((d) => valeurRun(d, "BUILD")), couleur: "#3fcce3", empile: true },
    ],
    {},
  );
  const noeuds = [...new Set(familles.map((x) => x.domaine))].map((d) => {
    const lignes = familles.filter((x) => x.domaine === d);
    return { name: d, value: Math.round(lignes.reduce((t, x) => t + x.ca, 0)), children: lignes.slice(0, 8).map((x) => ({ name: x.famille, value: Math.round(x.ca) })) };
  });
  const lignesTable: Ligne[] = [...domaines]
    .sort((a, b) => b.ca - a.ca)
    .map((d) => ({
      domaine: { t: d.membre },
      ca: { t: euros(d.ca), v: d.ca },
      caN1: { t: comparable ? euros(d.caN1) : "—", v: d.caN1 },
      ecart: { t: comparable ? euros(d.ca - d.caN1) : "—", v: d.ca - d.caN1, classe: d.ca - d.caN1 >= 0 ? "ton-bon" : "ton-mauvais" },
      variation: { t: comparable && d.caN1 > 0 ? variation(d.ca / d.caN1 - 1) : "—", v: d.caN1 > 0 ? d.ca / d.caN1 - 1 : null },
      part: { t: pct(d.ca / totalDom, 1), v: d.ca / totalDom },
    }));
  return (
    <>
      <Entete titre="Activité" question="Quels domaines, produits et commerciaux portent le chiffre d'affaires ?" ctx={ctx} />
      <div className="grille">
        <Kpi titre="CA facturé" valeur={euros(k.ca)} delta={comparable ? { ratio: k.caN1 > 0 ? k.ca / k.caN1 - 1 : null, absolu: euros(k.ca - k.caN1) } : undefined} classe="c3" />
        <Kpi titre="Clients actifs" valeur={k.actifs.toLocaleString("fr-FR")} detail={comparable ? `${k.actifsN1} l'an dernier` : undefined} classe="c3" />
        <Kpi titre="CA moyen par client" valeur={euros(k.actifs ? k.ca / k.actifs : null)} classe="c3" />
        <Kpi titre="Part du groupe actionnaire" valeur={pct(k.partGroupe, 0)} aide="Part du CA facturé aux clients du groupe actionnaire (référence Sage)." classe="c3" />
        <Tuile titre="CA par domaine dans le temps" sousTitre="Mois Sage · faites glisser le curseur pour zoomer, cliquez sur un domaine pour filtrer" classe="c8">
          <Graphique option={optionTemps} titre="CA par domaine et par mois" hauteur={340} clic={{ param: "dom", sur: "nom" }} />
        </Tuile>
        <Tuile titre="Poids des domaines" sousTitre={`Part du CA sur la période`} classe="c4">
          <Graphique option={optionDonut(domaines.map((d) => ({ nom: d.membre, valeur: Math.max(d.ca, 0) })))} titre="Part du CA par domaine" hauteur={340} clic={{ param: "dom", sur: "nom" }} />
        </Tuile>
        <Tuile titre="Domaine puis famille de produit" sousTitre="Cliquez pour descendre dans le détail" classe="c6">
          <Graphique option={optionTreemap(noeuds)} titre="CA par domaine et famille de produit" hauteur={330} />
        </Tuile>
        <Tuile titre="Récurrent contre projets par domaine" sousTitre="Run : exploitation et maintenance · Build : projets" classe="c6">
          <Graphique option={optionRun} titre="CA Run et Build par domaine" hauteur={330} />
        </Tuile>
        <Tuile titre="Dix premières familles de produit" sousTitre="Période et même période de l'an dernier" classe="c6">
          <Graphique
            option={optionBarresHorizontales(
              topFamilles.map((x) => ({ libelle: x.membre, valeur: x.ca })),
              { nom: "Période", comparaison: comparable ? { nom: "N-1", valeurs: topFamilles.map((x) => x.caN1) } : undefined },
            )}
            titre="CA des dix premières familles"
            hauteur={380}
          />
        </Tuile>
        <Tuile titre="Dix premiers commerciaux" sousTitre="CA facturé rattaché au code commercial" aide="Code commercial porté par la facture Sage. Les noms ne sont pas conservés (données personnelles)." classe="c6">
          <Graphique
            option={optionBarresHorizontales(
              topComm.map((x) => ({ libelle: `Commercial ${x.commercial}`, valeur: x.ca })),
              { nom: "Période", comparaison: comparable ? { nom: "N-1", valeurs: topComm.map((x) => x.caN1) } : undefined },
            )}
            titre="CA des dix premiers commerciaux"
            hauteur={380}
          />
        </Tuile>
        <Tuile titre="Détail par domaine" classe="c12" plein>
          <TableauDonnees
            nomExport="activite_par_domaine"
            recherche={false}
            colonnes={[
              { cle: "domaine", libelle: "Domaine" },
              { cle: "ca", libelle: "CA", num: true },
              { cle: "caN1", libelle: "CA N-1", num: true },
              { cle: "ecart", libelle: "Écart", num: true },
              { cle: "variation", libelle: "Évolution", num: true },
              { cle: "part", libelle: "Part du CA", num: true },
            ]}
            lignes={lignesTable}
            triInitial={{ cle: "ca", sens: "desc" }}
          />
        </Tuile>
      </div>
    </>
  );
}
