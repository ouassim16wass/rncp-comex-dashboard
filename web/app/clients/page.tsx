import { Graphique } from "@/components/charts/Graphique";
import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { TableauDonnees, type Ligne } from "@/components/ui/TableauDonnees";
import { Tuile } from "@/components/ui/Tuile";
import { retention, serieParDimension } from "@/lib/analyses";
import { concentration, kpis, portefeuille, type Statut } from "@/lib/comex";
import { lireContexte } from "@/lib/contexte";
import type { ParamsUrl } from "@/lib/filtres";
import { euros, libellePeriode, pct, variation } from "@/lib/format";
import { couleurPour, optionContributions, optionNuage, optionPareto, optionSeries } from "@/lib/graphiques";
import { tousLesScores } from "@/lib/score";

export const dynamic = "force-dynamic";

const LIBELLE: Record<Statut, string> = { nouveau: "Nouveau", hausse: "En hausse", stable: "Stable", baisse: "En baisse", perdu: "Perdu" };
const CLASSE: Record<Statut, string> = { nouveau: "ton-bon", hausse: "ton-bon", stable: "", baisse: "ton-alerte", perdu: "ton-mauvais" };

export default async function Page({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const ctx = await lireContexte(await searchParams);
  const { f, comparable, filtre } = ctx;
  const mouvements = comparable && ctx.mode !== "mois";
  const [k, lignes, scores, ret, conc, segmentsSerie] = await Promise.all([
    kpis(f, filtre),
    portefeuille(f, filtre),
    tousLesScores(),
    retention(f, filtre),
    concentration(f, filtre, 20),
    serieParDimension("segment", { domaines: filtre.domaines }),
  ]);
  const periodes = [...new Set(segmentsSerie.map((s) => s.periode))].filter((p) => ctx.mois.includes(p)).sort();
  const segments = [...new Set(segmentsSerie.map((s) => s.membre))];
  const optionSegments = optionSeries(
    periodes.map(libellePeriode),
    segments.map((s, i) => ({ nom: s, valeurs: periodes.map((p) => segmentsSerie.find((x) => x.periode === p && x.membre === s)?.ca ?? 0), couleur: couleurPour(s, i), empile: true })),
    { zoom: true },
  );
  const points = lignes
    .filter((l) => l.caN1 >= 2000 && l.ca > 0)
    .map((l) => {
      const v = Math.max(Math.min(l.ca / l.caN1 - 1, 3), -1);
      return {
        nom: `${l.client} · CA ${euros(l.ca)} · ${variation(l.ca / l.caN1 - 1)}`,
        x: l.caN1,
        y: v,
        taille: Math.max(7, Math.min(34, Math.sqrt(l.ca) / 45)),
        groupe: l.statut === "hausse" ? "En hausse" : l.statut === "baisse" ? "En baisse" : "Stable",
      };
    });
  const deltaTotal = k.ca - k.caN1;
  const deltaHausse = k.enHausse.ca - k.enHausse.caN1;
  const deltaBaisse = k.enBaisse.ca - k.enBaisse.caN1;
  const deltaStables = deltaTotal - k.nouveaux.ca - deltaHausse - deltaBaisse + k.perdus.ca;
  const tableau: Ligne[] = lignes.map((l) => ({
    client: { t: l.client, href: `/clients/${l.tiersId}?p=${ctx.fin}&mode=${ctx.mode}` },
    segment: { t: l.segment },
    ca: { t: euros(l.ca), v: l.ca },
    caN1: { t: comparable ? euros(l.caN1) : "—", v: l.caN1 },
    variation: { t: comparable && l.variation !== null ? variation(l.variation) : "—", v: l.variation },
    part: { t: pct(l.part, 1), v: l.part },
    situation: { t: comparable ? LIBELLE[l.statut] : "—", classe: comparable ? CLASSE[l.statut] : "" },
    silence: { t: l.moisSansFacture ? `${l.moisSansFacture} mois` : "—", v: l.moisSansFacture ?? 0 },
    echu: { t: l.echu > 0 ? euros(l.echu) : "—", v: l.echu },
    risque: {
      t: scores.get(l.tiersId) ? `${scores.get(l.tiersId)?.niveau} · ${pct(scores.get(l.tiersId)?.probabilite, 0)}` : "—",
      v: scores.get(l.tiersId)?.probabilite ?? -1,
      classe: scores.get(l.tiersId)?.niveau === "élevé" ? "ton-mauvais" : scores.get(l.tiersId)?.niveau === "moyen" ? "ton-alerte" : "",
    },
  }));
  return (
    <>
      <Entete titre="Clients" question="Qui croît, qui décroche, qui part, et notre portefeuille est-il fidèle ?" ctx={ctx} />
      <div className="grille">
        <Kpi titre="Clients actifs" valeur={k.actifs.toLocaleString("fr-FR")} detail={comparable ? `${k.actifsN1} sur la période comparée` : undefined} classe="c2" />
        <Kpi titre="Nouveaux" valeur={mouvements ? `+${k.nouveaux.nb}` : "—"} detail={mouvements ? euros(k.nouveaux.ca) : undefined} classe="c2" aide="Clients facturés cette année et pas l'an dernier." />
        <Kpi titre="Perdus" valeur={mouvements ? `−${k.perdus.nb}` : "—"} detail={mouvements ? `${euros(k.perdus.ca)} l'an dernier` : undefined} classe="c2" aide="Clients facturés l'an dernier et plus cette année." />
        <Kpi titre="Rétention nette" valeur={pct(ret.nrr, 0)} aide="CA des clients existants cette année divisé par leur CA de l'an dernier." classe="c2" />
        <Kpi titre="Rétention brute" valeur={pct(ret.grr, 0)} aide="Comme la rétention nette, mais sans compter les hausses : mesure uniquement ce qui est conservé." classe="c2" />
        <Kpi titre="Clients conservés" valeur={pct(ret.logos, 0)} detail={comparable ? `${ret.conserves} sur ${ret.base}` : undefined} classe="c2" />
        <Tuile titre="Matrice de croissance" sousTitre="Chaque bulle est un client : CA de l'an dernier (échelle log), évolution, taille = CA actuel" classe="c7">
          {comparable ? (
            <Graphique
              option={optionNuage(
                points,
                [
                  { nom: "En hausse", couleur: "#5bc500" },
                  { nom: "Stable", couleur: "#8a90b8" },
                  { nom: "En baisse", couleur: "#d31205" },
                ],
                { x: "CA de l'an dernier", y: "Évolution", logX: true },
              )}
              titre="Matrice de croissance des clients"
              hauteur={360}
            />
          ) : (
            <p className="vide">Comparaison avec l&apos;an dernier indisponible pour cette fenêtre.</p>
          )}
        </Tuile>
        <Tuile titre="D'où vient la variation du CA" sousTitre={`Contribution de chaque groupe de clients · total ${deltaTotal >= 0 ? "+" : "−"}${euros(Math.abs(deltaTotal))}`} classe="c5">
          {mouvements ? (
            <Graphique
              option={optionContributions([
                { label: "Nouveaux clients", valeur: k.nouveaux.ca },
                { label: "Clients en hausse", valeur: deltaHausse },
                { label: "Clients stables", valeur: deltaStables },
                { label: "Clients en baisse", valeur: deltaBaisse },
                { label: "Clients perdus", valeur: -k.perdus.ca },
              ])}
              titre="Contribution de chaque groupe de clients à l'évolution du CA"
              hauteur={360}
            />
          ) : (
            <p className="vide">Choisissez « Cumul annuel » pour comparer à l&apos;an dernier.</p>
          )}
        </Tuile>
        <Tuile titre="Concentration du CA" sousTitre={`Top 5 : ${pct(conc.top5, 0)} · Top 10 : ${pct(conc.top10, 0)}`} classe="c6">
          <Graphique option={optionPareto(conc.top.map((t) => t.client), conc.top.map((t) => t.part), conc.top.map((t) => t.cumul))} format="pct" titre="Concentration du CA" hauteur={300} />
        </Tuile>
        <Tuile titre="Groupe actionnaire et autres segments" sousTitre="CA par segment de client et par mois" classe="c6">
          <Graphique option={optionSegments} titre="CA par segment et par mois" hauteur={300} />
        </Tuile>
        <Tuile titre="Portefeuille clients" sousTitre="Cliquez sur un client pour sa fiche détaillée" classe="c12" plein>
          <TableauDonnees
            nomExport="clients"
            taille={15}
            colonnes={[
              { cle: "client", libelle: "Client" },
              { cle: "segment", libelle: "Segment" },
              { cle: "ca", libelle: "CA", num: true },
              { cle: "caN1", libelle: "CA N-1", num: true },
              { cle: "variation", libelle: "Évolution", num: true },
              { cle: "part", libelle: "Part du CA", num: true },
              { cle: "situation", libelle: "Situation" },
              { cle: "silence", libelle: "Sans facture", num: true },
              { cle: "echu", libelle: "Créances échues", num: true },
              { cle: "risque", libelle: "Risque de départ" },
            ]}
            lignes={tableau}
            triInitial={{ cle: "ca", sens: "desc" }}
          />
        </Tuile>
      </div>
    </>
  );
}
