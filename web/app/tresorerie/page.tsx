import { Graphique } from "@/components/charts/Graphique";
import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { TableauDonnees, type Ligne } from "@/components/ui/TableauDonnees";
import { Tuile } from "@/components/ui/Tuile";
import { dettesParTranche, echeancesTrancheSegment } from "@/lib/analyses";
import { caDouzeMois, moisDisponibles, tresorerie } from "@/lib/comex";
import { euros, libelleDate, pct } from "@/lib/format";
import { couleurPour, optionPareto, optionSeries } from "@/lib/graphiques";
import { maintenant } from "@/lib/maintenant";

export const dynamic = "force-dynamic";

const ORDRE = ["non échu", "moins de 15 jours", "15 à 30 jours", "plus de 30 jours"];

export default async function Page() {
  const mois = await moisDisponibles();
  const [t, ca12, trancheSegment, dettes] = await Promise.all([tresorerie(), caDouzeMois(mois[mois.length - 2]), echeancesTrancheSegment(), dettesParTranche()]);
  const age = t.photo ? Math.floor((maintenant().getTime() - new Date(t.photo).getTime()) / 86_400_000) : null;
  const segments = [...new Set(trancheSegment.map((x) => x.segment))];
  const optionAnciennete = optionSeries(
    ORDRE,
    segments.map((s, i) => ({ nom: s, valeurs: ORDRE.map((tr) => trancheSegment.find((x) => x.tranche === tr && x.segment === s)?.solde ?? 0), couleur: couleurPour(s, i), empile: true })),
    {},
  );
  const totalDebiteurs = t.debiteurs.reduce((s, d) => s + d.echu, 0) || 1;
  let cumul = 0;
  const cumuls = t.debiteurs.map((d) => (cumul += d.echu) / totalDebiteurs);
  const optionDettes = optionSeries(ORDRE, [{ nom: "Dettes fournisseurs", valeurs: ORDRE.map((tr) => dettes.find((x) => x.tranche === tr)?.solde ?? 0), couleur: "#44437f" }], { legende: false });
  const tableau: Ligne[] = t.debiteurs.map((d) => ({
    client: { t: d.client, href: `/clients/${d.tiersId}` },
    segment: { t: d.segment },
    total: { t: euros(d.total), v: d.total },
    echu: { t: euros(d.echu), v: d.echu },
    echu30: { t: d.echu30 > 0 ? euros(d.echu30) : "—", v: d.echu30 },
    pieces: { t: String(d.nb), v: d.nb },
    retard: { t: d.retardMax > 0 ? `${d.retardMax} j` : "—", v: d.retardMax, classe: d.retardMax > 90 ? "ton-mauvais" : "" },
  }));
  const enMois = ca12 > 0 ? t.creances / (ca12 / 12) : null;
  return (
    <>
      <Entete titre="Trésorerie" question="Ce que les clients nous doivent, depuis quand, et qui relancer en priorité ?" filtres={false} />
      {age !== null && age > 30 && t.photo && (
        <div className="avertissement" style={{ marginTop: 14 }}>
          Ces montants datent du {libelleDate(t.photo)}, soit {age} jours : ils ne reflètent pas la situation du jour. Une seule photo est disponible : pas d&apos;évolution dans le temps.
        </div>
      )}
      <div className="grille">
        <Kpi titre="Créances clients ouvertes" valeur={euros(t.creances)} detail={`${t.nbPieces.toLocaleString("fr-FR")} pièces ouvertes (clients et fournisseurs)`} classe="c3" />
        <Kpi titre="Dont échues" valeur={euros(t.echu)} delta={{ ratio: null, libelle: `${pct(t.creances ? t.echu / t.creances : null, 0)} des créances` }} detail={`${euros(t.echu30)} à plus de 30 jours`} classe="c3" aide="Créances dont l'échéance est atteinte ou dépassée à la date de photo." />
        <Kpi titre="Dettes fournisseurs" valeur={euros(t.dettes)} detail={`dont ${euros(t.dettesEchues)} échues`} classe="c3" />
        <Kpi
          titre="Créances en mois de CA"
          valeur={enMois === null ? "—" : enMois.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
          detail={`Position nette : ${euros(t.creances - t.dettes)}`}
          aide="Créances ouvertes divisées par le CA mensuel moyen des 12 derniers mois. Indicatif : les soldes Sage sont peut-être TTC."
          classe="c3"
        />
        <Tuile titre="Ancienneté des créances" sousTitre="Par tranche de retard et segment de client" classe="c6">
          <Graphique option={optionAnciennete} titre="Créances par tranche de retard et segment" hauteur={320} />
        </Tuile>
        <Tuile titre="Clients à relancer en priorité" sousTitre="Les 15 premiers débiteurs échus et leur part cumulée" classe="c6">
          <Graphique option={optionPareto(t.debiteurs.map((d) => d.client), t.debiteurs.map((d) => d.echu / totalDebiteurs), cumuls)} format="pct" titre="Concentration des créances échues" hauteur={320} />
        </Tuile>
        <Tuile titre="Dettes fournisseurs par ancienneté" sousTitre="Montants dus aux fournisseurs" classe="c4">
          <Graphique option={optionDettes} titre="Dettes fournisseurs par tranche de retard" hauteur={260} />
        </Tuile>
        <Tuile titre="Créances par segment" classe="c8" plein>
          <TableauDonnees
            nomExport="creances_par_segment"
            recherche={false}
            colonnes={[
              { cle: "segment", libelle: "Segment" },
              { cle: "total", libelle: "Créances", num: true },
              { cle: "echu", libelle: "Échu", num: true },
              { cle: "echu30", libelle: "Plus de 30 jours", num: true },
              { cle: "part", libelle: "Part échue", num: true },
            ]}
            lignes={t.parSegment.map((s) => ({
              segment: { t: s.segment },
              total: { t: euros(s.total), v: s.total },
              echu: { t: euros(s.echu), v: s.echu },
              echu30: { t: euros(s.echu30), v: s.echu30 },
              part: { t: pct(s.total ? s.echu / s.total : null, 0), v: s.total ? s.echu / s.total : 0 },
            }))}
          />
        </Tuile>
        <Tuile titre="Clients débiteurs" sousTitre="Classés par montant échu" classe="c12" plein>
          <TableauDonnees
            nomExport="clients_debiteurs"
            colonnes={[
              { cle: "client", libelle: "Client" },
              { cle: "segment", libelle: "Segment" },
              { cle: "total", libelle: "Créances", num: true },
              { cle: "echu", libelle: "Échu", num: true },
              { cle: "echu30", libelle: "Plus de 30 jours", num: true },
              { cle: "pieces", libelle: "Pièces", num: true },
              { cle: "retard", libelle: "Retard maximum", num: true },
            ]}
            lignes={tableau}
            triInitial={{ cle: "echu", sens: "desc" }}
          />
        </Tuile>
      </div>
    </>
  );
}
