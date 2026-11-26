import Link from "next/link";
import { AlertesComex } from "@/components/AlertesComex";
import { Graphique } from "@/components/charts/Graphique";
import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { Tuile } from "@/components/ui/Tuile";
import { buildRunMensuel, famillesParDomaine, retention } from "@/lib/analyses";
import { construireAlertes } from "@/lib/alertes";
import { concentration, ecartComptable, kpis, margeKpi, pipeline, pont, serieMensuelle, tresorerie } from "@/lib/comex";
import { lireContexte } from "@/lib/contexte";
import type { ParamsUrl } from "@/lib/filtres";
import { euros, libelleDate, libelleMois, libellePeriode, pct } from "@/lib/format";
import { optionBarresHorizontales, optionPareto, optionPont, optionSeries, optionTreemap } from "@/lib/graphiques";
import { operations } from "@/lib/analyses";
import { libelleMode } from "@/lib/periode";
import { surveillance, synthese } from "@/lib/score";
import { maintenant } from "@/lib/maintenant";

export const dynamic = "force-dynamic";

const DIMENSIONS_PONT = [
  ["domaine", "Domaine"],
  ["segment", "Segment"],
  ["famille", "Famille"],
  ["commercial", "Commercial"],
] as const;

const rapport = (a: number, b: number) => (b > 0 ? a / b - 1 : null);
const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const params = await searchParams;
  const ctx = await lireContexte(params);
  const { f, comparable, filtre } = ctx;
  const dimension = DIMENSIONS_PONT.find(([c]) => c === un(params.pd))?.[0] ?? "domaine";
  const [k, serie, lignesPont, lignesDomaine, conc, marge, ecart, treso, pip, risque, runs, ret, familles, ops, suivi] = await Promise.all([
    kpis(f, filtre),
    serieMensuelle(filtre),
    pont(f, dimension, filtre),
    pont(f, "domaine", filtre),
    concentration(f, filtre, 20),
    margeKpi(f),
    ecartComptable(),
    tresorerie(),
    pipeline(),
    synthese(),
    buildRunMensuel(filtre),
    retention(f, filtre),
    famillesParDomaine(f, filtre),
    operations(),
    surveillance(),
  ]);
  const caN1 = comparable ? k.caN1 : 0;
  const mouvementsPertinents = comparable && ctx.mode !== "mois";
  const alertes = construireAlertes({
    ca: k.ca,
    caN1,
    libelleFenetre: libelleMode(ctx.mode),
    domaines: comparable ? lignesDomaine.map((d) => ({ membre: d.membre, ca: d.ca, caN1: d.caN1 })) : [],
    top1: conc.top1,
    top5: conc.top5,
    partGroupe: k.partGroupe,
    perdus: mouvementsPertinents ? k.perdus : { nb: 0, ca: 0 },
    nouveaux: k.nouveaux,
    creances: { total: treso.creances, echu30: treso.echu30, photo: treso.photo },
    pipelinePhoto: pip.photo,
    ecartComptable: ecart,
    risque: risque
      ? {
          eleves: risque.niveaux["élevé"].clients,
          moyens: risque.niveaux.moyen.clients,
          partCA: risque.niveaux["élevé"].part_du_ca,
          partCAMoyen: risque.niveaux.moyen.part_du_ca,
        }
      : null,
    derive: (() => {
      const m = suivi?.mesures.find((x) => x.indicateur === "psi_max");
      return m && m.valeur !== null ? { psiMax: m.valeur, statut: m.statut } : null;
    })(),
    aujourdhui: maintenant(),
  });
  const parPeriode = new Map(serie.map((s) => [s.periode, s.ca]));
  const annees = [...new Set(serie.filter((s) => ctx.mois.includes(s.periode)).map((s) => Math.floor(s.periode / 100)))].slice(-2);
  const mois = Array.from({ length: 12 }, (_, i) => i + 1);
  const val = (a: number, m: number) => (ctx.mois.includes(a * 100 + m) ? (parPeriode.get(a * 100 + m) ?? null) : null);
  const [anneeN1, anneeN] = annees.length === 2 ? annees : [null, annees[0]];
  const ecarts = mois.map((m) => {
    const a = anneeN ? val(anneeN, m) : null;
    const b = anneeN1 ? val(anneeN1, m) : null;
    return a !== null && b ? a / b - 1 : null;
  });
  const optionCA = optionSeries(
    mois.map(libelleMois),
    [
      ...(anneeN1 ? [{ nom: String(anneeN1), valeurs: mois.map((m) => val(anneeN1, m)), couleur: "#b9c9e6" }] : []),
      ...(anneeN ? [{ nom: String(anneeN), valeurs: mois.map((m) => val(anneeN, m)), couleur: "#141c52" }] : []),
      ...(anneeN1 ? [{ nom: "Écart vs an dernier", valeurs: ecarts, type: "line" as const, axe: 1 as const, couleur: "#008ae0", format: "pct" as const }] : []),
    ],
    {},
  );
  const tri = [...lignesPont].sort((a, b) => Math.abs(b.ca - b.caN1) - Math.abs(a.ca - a.caN1));
  const elementsPont = [
    ...tri.slice(0, 6).map((l) => ({ label: l.membre, delta: l.ca - l.caN1 })).sort((a, b) => b.delta - a.delta),
    ...(tri.length > 6 ? [{ label: "Autres", delta: tri.slice(6).reduce((t, l) => t + l.ca - l.caN1, 0) }] : []),
  ];
  const domainesTries = [...lignesDomaine].sort((a, b) => b.ca - a.ca);
  const optionDomaines = optionBarresHorizontales(
    domainesTries.map((d) => ({ libelle: d.membre, valeur: d.ca, couleur: ctx.domaines.includes(d.membre) ? "#141c52" : "#008ae0" })),
    { nom: `CA ${Math.floor(f.fin / 100)}`, comparaison: comparable ? { nom: `CA ${Math.floor(f.finN1 / 100)}`, valeurs: domainesTries.map((d) => d.caN1) } : undefined },
  );
  const renseigne = (p: number) => runs.filter((r) => r.periode === p && (r.mode === "RUN" || r.mode === "BUILD")).reduce((t, r) => t + r.ca, 0) > 0;
  const periodesRun = [...new Set(runs.map((r) => r.periode))].filter((p) => ctx.mois.includes(p) && renseigne(p)).sort();
  const positif = (p: number, mode: string) => Math.max(runs.filter((r) => r.periode === p && r.mode === mode).reduce((t, r) => t + r.ca, 0), 0);
  const part = (p: number, mode: string) => {
    const total = positif(p, "RUN") + positif(p, "BUILD");
    return total ? positif(p, mode) / total : null;
  };
  const optionRun = optionSeries(
    periodesRun.map(libellePeriode),
    [
      { nom: "Run (récurrent)", valeurs: periodesRun.map((p) => part(p, "RUN")), couleur: "#141c52", empile: true, type: "line", aire: true },
      { nom: "Build (projets)", valeurs: periodesRun.map((p) => part(p, "BUILD")), couleur: "#3fcce3", empile: true, type: "line", aire: true },
    ],
    { pct: true },
  );
  const sommeRun = (debut: number, fin: number, mode: string) => runs.filter((r) => r.periode >= debut && r.periode <= fin && r.mode === mode).reduce((t, r) => t + r.ca, 0);
  const runN = sommeRun(f.debut, f.fin, "RUN");
  const buildN = sommeRun(f.debut, f.fin, "BUILD");
  const partRun = runN + buildN > 0 ? runN / (runN + buildN) : null;
  const runN1 = sommeRun(f.debutN1, f.finN1, "RUN");
  const buildN1 = sommeRun(f.debutN1, f.finN1, "BUILD");
  const partRunN1 = comparable && runN1 + buildN1 > 0 ? runN1 / (runN1 + buildN1) : null;
  const noeuds = [...new Set(familles.map((x) => x.domaine))].map((d) => {
    const lignes = familles.filter((x) => x.domaine === d);
    const principaux = lignes.slice(0, 6).map((x) => ({ name: x.famille, value: Math.round(x.ca) }));
    const reste = lignes.slice(6).reduce((t, x) => t + x.ca, 0);
    return { name: d, value: Math.round(lignes.reduce((t, x) => t + x.ca, 0)), children: [...principaux, ...(reste > 0 ? [{ name: "Autres familles", value: Math.round(reste) }] : [])] };
  });
  const echuPart = treso.creances > 0 ? treso.echu / treso.creances : null;
    const slaRespecte = ops.slaGlobal === null ? null : 1 - ops.slaGlobal;
  const tauxMarge = marge.ca && marge.marge !== null ? marge.marge / marge.ca : null;
  const valeursSerie = serie.map((s) => s.ca);
  return (
    <>
      <Entete titre="Synthèse COMEX" question="Où en est-on, qu'est-ce qui doit m'alerter, et d'où vient l'évolution ?" ctx={ctx} />
      <div className="grille">
        <Kpi
          titre="CA facturé"
          valeur={euros(k.ca)}
          delta={comparable ? { ratio: rapport(k.ca, k.caN1), absolu: euros(k.ca - k.caN1) } : { ratio: null, libelle: "N-1 indisponible pour cette fenêtre" }}
          serie={valeursSerie}
          aide="Chiffre d'affaires HT des factures de vente Sage, par mois Sage, hors service 990. Source : extraction « CA facturé »."
          lien="/activite"
        />
        <Kpi
          titre="Marge brute (provisoire)"
          valeur={euros(marge.marge)}
          delta={{ ratio: null, libelle: "pas de comptabilité N-1" }}
          detail={tauxMarge !== null ? `Taux de marge : ${pct(tauxMarge, 1)} du CA comptable` : undefined}
          aide="CA comptable (classe 1) moins achats (classe 2). Le périmètre des charges directes reste à confirmer avec la direction financière."
          lien="/finance"
        />
        <Kpi
          titre="CA récurrent (Run)"
          valeur={pct(partRun, 0)}
          delta={partRunN1 !== null && partRun !== null ? { ratio: partRun - partRunN1, libelle: "vs an dernier", points: true } : undefined}
          detail={`${euros(runN)} récurrent · ${euros(buildN)} projets`}
          aide="Part du CA marquée « Run » (exploitation, maintenance) par rapport à « Build » (projets). Indicateur de récurrence des revenus."
          lien="/activite"
        />
        <Kpi
          titre="Rétention nette des clients"
          valeur={pct(ret.nrr, 0)}
          detail={comparable ? `Rétention brute ${pct(ret.grr, 0)} · ${pct(ret.logos, 0)} des clients conservés` : "Comparaison N-1 indisponible"}
          aide="CA de cette année des clients déjà facturés l'an dernier, divisé par leur CA de l'an dernier. Au-dessus de 100 %, les clients existants dépensent davantage."
          lien="/clients"
        />
        <Kpi
          titre="Clients actifs"
          valeur={k.actifs.toLocaleString("fr-FR")}
          delta={comparable ? { ratio: rapport(k.actifs, k.actifsN1), absolu: `${k.actifs - k.actifsN1 > 0 ? "+" : ""}${k.actifs - k.actifsN1}` } : undefined}
          detail={`CA moyen par client : ${euros(k.actifs ? k.ca / k.actifs : null)}`}
          aide="Clients ayant au moins une facture positive sur la période."
          lien="/clients"
        />
        <Kpi
          titre="Créances échues"
          valeur={euros(treso.echu)}
          delta={{ ratio: null, libelle: echuPart !== null ? `${pct(echuPart, 0)} des créances` : "" }}
          detail={`dont ${euros(treso.echu30)} à plus de 30 jours · photo du ${treso.photo ? libelleDate(treso.photo) : "—"}`}
          aide="Soldes clients dont l'échéance est atteinte ou dépassée à la date de photo des échéances Sage."
          lien="/tresorerie"
        />
        <Kpi
          titre="Pipeline ouvert"
          valeur={euros(pip.ouvert.montant)}
          detail={`${pip.ouvert.nb.toLocaleString("fr-FR")} opportunités · photo du ${pip.photo ? libelleDate(pip.photo) : "—"}`}
          aide="Montant des opportunités Salesforce ni fermées ni abandonnées, à la date de la dernière extraction."
          lien="/commercial"
        />
        <Kpi
          titre="Respect des délais (SLA)"
          valeur={pct(slaRespecte, 0)}
          detail={ops.debut && ops.fin ? `Tickets du ${libelleDate(ops.debut)} au ${libelleDate(ops.fin)}` : undefined}
          aide="Part des tickets iTop dont le délai de résolution contractuel (TTR) est respecté. Les tickets ne couvrent que 7 semaines."
          lien="/operations"
        />
        <Tuile titre="CA facturé par mois" sousTitre="Cette année et l'an dernier, avec l'écart en %" aide="Mois Sage. Le dernier mois, partiel, est exclu." classe="c8">
          <Graphique option={optionCA} titre="CA facturé par mois" hauteur={300} />
        </Tuile>
        <Tuile titre="Points d'attention" sousTitre="Calculés automatiquement à partir des données" classe="c4">
          <div className="alertes-compact">
            <AlertesComex alertes={alertes} />
          </div>
        </Tuile>
        <Tuile titre="CA par domaine" sousTitre="Cliquez sur une barre pour filtrer toute la page" classe="c4">
          <Graphique option={optionDomaines} titre="CA par domaine" hauteur={300} clic={{ param: "dom", sur: "categorie", valeurs: ["D1", "D2", "D3", "D4", "HD"] }} />
        </Tuile>
        <Tuile
          titre="D'où vient l'évolution"
          sousTitre="CA de l'an dernier à cette année"
          classe="c4"
          actions={
            <div className="bascule" role="group" aria-label="Axe d'analyse">
              {DIMENSIONS_PONT.map(([cle, libelle]) => {
                const q = new URLSearchParams(Object.entries(params).flatMap(([c, v]) => (typeof v === "string" && c !== "pd" ? [[c, v]] : [])));
                q.set("pd", cle);
                return (
                  <Link key={cle} href={`/?${q.toString()}`} aria-pressed={dimension === cle}>
                    {libelle}
                  </Link>
                );
              })}
            </div>
          }
        >
          {comparable ? (
            <Graphique option={optionPont(k.caN1, k.ca, String(Math.floor(f.finN1 / 100)), String(Math.floor(f.fin / 100)), elementsPont)} titre="Pont du CA" hauteur={300} />
          ) : (
            <p className="vide">Comparaison avec l&apos;an dernier impossible pour cette fenêtre.</p>
          )}
        </Tuile>
        <Tuile titre="Récurrent contre projets" sousTitre="Part du CA Run et Build par mois" classe="c4">
          <Graphique option={optionRun} format="pct" titre="Part Run et Build par mois" hauteur={300} />
        </Tuile>
        <Tuile titre="Où se fait le CA" sousTitre={`Domaine puis famille de produit · ${libelleMode(ctx.mode)}`} classe="c6">
          <Graphique option={optionTreemap(noeuds)} titre="CA par domaine et famille de produit" hauteur={320} />
        </Tuile>
        <Tuile
          titre="Dépendance aux gros clients"
          sousTitre={`Top 5 : ${pct(conc.top5, 0)} · Top 10 : ${pct(conc.top10, 0)} · Top 20 : ${pct(conc.top20, 0)} du CA`}
          classe="c6"
          aide="Part du CA de chacun des 20 premiers clients et part cumulée."
        >
          <Graphique option={optionPareto(conc.top.map((t) => t.client), conc.top.map((t) => t.part), conc.top.map((t) => t.cumul))} format="pct" titre="Concentration du CA" hauteur={320} />
        </Tuile>
      </div>
      <p className="note-bas">
        Facturation jusqu&apos;à {libellePeriode(ctx.dernierMois - 1)} (mois suivant partiel, exclu). <Link href="/qualite">Fiabilité et limites des données →</Link>
      </p>
    </>
  );
}
