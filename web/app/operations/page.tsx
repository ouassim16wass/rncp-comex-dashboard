import { Graphique } from "@/components/charts/Graphique";
import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { Tuile } from "@/components/ui/Tuile";
import { operations } from "@/lib/analyses";
import { euros, libelleDate, pct } from "@/lib/format";
import { optionBarresHorizontales, optionDonut, optionSeries } from "@/lib/graphiques";

export const dynamic = "force-dynamic";

export default async function Page() {
  const o = await operations();
  const jours = [...new Set(o.quotidien.map((q) => q.jour))].sort();
  const types = [...new Set(o.quotidien.map((q) => q.type))].filter((t) => t !== "Non renseigné").sort();
  const couleurs: Record<string, string> = { incident: "#d31205", demande: "#008ae0" };
  const optionJours = optionSeries(
    jours.map((j) => libelleDate(j).replace(/ 20\d\d$/, "")),
    types.map((t) => ({ nom: t, valeurs: jours.map((j) => o.quotidien.find((q) => q.jour === j && q.type === t)?.nb ?? 0), couleur: couleurs[t] ?? "#aaaaaa", empile: true })),
    { zoom: true },
  );
  const optionSla = optionSeries(
    o.hebdo.map((h) => new Date(h.semaine).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })),
    [
      { nom: "Tickets", valeurs: o.hebdo.map((h) => h.total), couleur: "#141c52" },
      { nom: "Délai dépassé", valeurs: o.hebdo.map((h) => (h.total ? h.depasses / h.total : null)), type: "line", axe: 1, couleur: "#d31205", format: "pct" },
    ],
    {},
  );
  const niveaux = ["Urgent", "Important", "Modéré", "Faible"];
  const parNiveau = niveaux.map((n) => ({ nom: n, valeur: o.priorites.filter((p) => p.niveau === n).reduce((t, p) => t + p.nb, 0) })).filter((x) => x.valeur > 0);
  const origineClient = o.priorites.filter((p) => p.origine === "Client").reduce((t, p) => t + p.nb, 0);
  const ordreDelais = ["Le jour même", "1 à 2 jours", "3 à 7 jours", "8 à 30 jours", "Plus de 30 jours"];
  const backlog = o.etats.filter((e) => !["Fermée", "Résolu"].includes(e.etat));
  return (
    <>
      <Entete titre="Opérations" question="Le support tient-il ses engagements et où sont les tensions ?" filtres={false} />
      <div className="avertissement" style={{ marginTop: 14 }}>
        Les tickets iTop fournis ne couvrent que du {o.debut ? libelleDate(o.debut) : "—"} au {o.fin ? libelleDate(o.fin) : "—"} : pas de comparaison avec l&apos;an dernier ni d&apos;évolution mensuelle.
        Ils ne sont pas rattachés aux clients ({o.clientsLies} liés) faute de table de correspondance.
      </div>
      <div className="grille">
        <Kpi titre="Tickets" valeur={o.total.toLocaleString("fr-FR")} detail={`${o.incidents.toLocaleString("fr-FR")} incidents · ${o.demandes.toLocaleString("fr-FR")} demandes`} classe="c3" />
        <Kpi titre="Délais respectés (incidents)" valeur={pct(o.slaIncidents === null ? null : 1 - o.slaIncidents, 0)} detail={`${pct(o.slaIncidents, 0)} d'incidents hors délai`} aide="Part des incidents dont le temps de résolution contractuel (TTR) est respecté." classe="c3" />
        <Kpi titre="Délais respectés (demandes)" valeur={pct(o.slaDemandes === null ? null : 1 - o.slaDemandes, 0)} detail={`${pct(o.slaDemandes, 0)} de demandes hors délai`} aide="Les demandes de service ont un taux de dépassement bien supérieur à celui des incidents." classe="c3" />
        <Kpi titre="Tickets non résolus" valeur={o.backlog.toLocaleString("fr-FR")} detail={`Résolution moyenne : ${o.resolutionMoyenne === null ? "—" : `${o.resolutionMoyenne.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} jour`}`} aide="Tickets dont l'état n'est ni Fermée ni Résolu." classe="c3" />
        <Tuile titre="Volume de tickets par jour" sousTitre="Incidents et demandes · faites glisser le curseur pour zoomer" classe="c8">
          <Graphique option={optionJours} format="nombre" titre="Tickets par jour" hauteur={320} />
        </Tuile>
        <Tuile titre="Délais dépassés par semaine" sousTitre="Semaines commençant le… · nombre de tickets et part hors délai" classe="c4">
          <Graphique option={optionSla} format="nombre" titre="Tickets et délais dépassés par semaine" hauteur={320} />
        </Tuile>
        <Tuile titre="Priorité" sousTitre={`${pct(origineClient / (o.total || 1), 0)} des tickets viennent de clients`} classe="c3">
          <Graphique option={optionDonut(parNiveau, ["#d31205", "#ffc844", "#008ae0", "#8a90b8"])} format="nombre" titre="Tickets par niveau de priorité" hauteur={280} />
        </Tuile>
        <Tuile titre="Impact" sousTitre="Qui est touché" classe="c3">
          <Graphique option={optionBarresHorizontales(o.impacts.map((i) => ({ libelle: i.impact, valeur: i.nb })))} format="nombre" titre="Tickets par niveau d'impact" hauteur={280} />
        </Tuile>
        <Tuile titre="Délai de résolution" sousTitre="Tickets résolus" classe="c3">
          <Graphique option={optionBarresHorizontales(ordreDelais.map((d) => ({ libelle: d, valeur: o.delais.find((x) => x.tranche === d)?.nb ?? 0 })), { nom: "Tickets" })} format="nombre" titre="Délai de résolution" hauteur={280} />
        </Tuile>
        <Tuile titre="Tickets en cours" sousTitre="Hors fermés et résolus" classe="c3">
          <Graphique option={optionBarresHorizontales(backlog.map((e) => ({ libelle: e.etat, valeur: e.nb })), { nom: "Tickets" })} format="nombre" titre="Tickets non résolus par état" hauteur={280} />
        </Tuile>
      </div>
      <p className="note-bas">{euros(0) ? "" : ""}Source : iTop. Le délai de résolution est la différence entre les dates d&apos;ouverture et de résolution.</p>
    </>
  );
}
