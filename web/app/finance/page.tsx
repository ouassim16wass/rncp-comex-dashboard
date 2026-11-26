import { Graphique } from "@/components/charts/Graphique";
import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { TableauDonnees, type Ligne } from "@/components/ui/TableauDonnees";
import { Tuile } from "@/components/ui/Tuile";
import { caComptableMensuel, compteResultat, margeMensuelle } from "@/lib/analyses";
import { margeKpi, margeParDomaine } from "@/lib/comex";
import { lireContexte } from "@/lib/contexte";
import type { ParamsUrl } from "@/lib/filtres";
import { euros, libellePeriode, pct, variation } from "@/lib/format";
import { optionPont, optionSeries } from "@/lib/graphiques";

export const dynamic = "force-dynamic";

const court = (classe: string) => classe.replace(/^\d+(\.\d+)?\s*-\s*/, "").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default async function Page({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const ctx = await lireContexte(await searchParams);
  const { f } = ctx;
  const [m, domaines, classes, mensuelle, facture] = await Promise.all([
    margeKpi(f),
    margeParDomaine(f),
    compteResultat(f),
    margeMensuelle(ctx.domaines),
    caComptableMensuel(),
  ]);
  const ca = classes.find((c) => c.classe.startsWith("1-"))?.montant ?? 0;
  const autres = classes.filter((c) => !c.classe.startsWith("1-"));
  const seuil = Math.abs(ca) * 0.01;
  const gros = autres.filter((c) => Math.abs(c.montant) >= seuil);
  const petits = autres.filter((c) => Math.abs(c.montant) < seuil).reduce((t, c) => t + c.montant, 0);
  const elements = [...gros.map((c) => ({ label: court(c.classe), delta: c.montant })), ...(petits !== 0 ? [{ label: "Autres", delta: petits }] : [])];
  const solde = classes.reduce((t, c) => t + c.montant, 0);
  const taux = m.ca && m.marge !== null ? m.marge / m.ca : null;
  const periodes = mensuelle.map((x) => x.periode);
  const optionMarge = optionSeries(
    periodes.map(libellePeriode),
    [
      { nom: "Marge brute", valeurs: mensuelle.map((x) => x.marge), couleur: "#141c52" },
      { nom: "Taux de marge", valeurs: mensuelle.map((x) => (x.ca ? x.marge / x.ca : null)), type: "line", axe: 1, couleur: "#5bc500", format: "pct" },
    ],
    { zoom: periodes.length > 8 },
  );
  const optionDomaines = optionSeries(
    domaines.map((d) => d.domaine),
    [
      { nom: "Marge brute", valeurs: domaines.map((d) => d.marge), couleur: "#141c52" },
      { nom: "Taux de marge", valeurs: domaines.map((d) => (d.ca ? d.marge / d.ca : null)), type: "line", axe: 1, couleur: "#5bc500", format: "pct" },
    ],
    {},
  );
  const commun = mensuelle.filter((x) => facture.some((y) => y.periode === x.periode));
  const optionRapprochement = optionSeries(
    commun.map((x) => libellePeriode(x.periode)),
    [
      { nom: "CA facturé", valeurs: commun.map((x) => facture.find((y) => y.periode === x.periode)?.ca ?? null), couleur: "#141c52" },
      { nom: "CA comptable", valeurs: commun.map((x) => x.ca), couleur: "#008ae0" },
    ],
    {},
  );
  const tableau: Ligne[] = classes.map((c) => ({
    classe: { t: c.classe },
    montant: { t: euros(c.montant), v: c.montant, classe: c.montant >= 0 ? "ton-bon" : "ton-mauvais" },
    part: { t: ca ? pct(c.montant / ca, 1) : "—", v: ca ? c.montant / ca : 0 },
  }));
  const tableauDomaines: Ligne[] = domaines.map((d) => ({
    domaine: { t: d.domaine },
    ca: { t: euros(d.ca), v: d.ca },
    achats: { t: euros(d.achats), v: d.achats },
    marge: { t: euros(d.marge), v: d.marge },
    taux: { t: pct(d.ca ? d.marge / d.ca : null, 1), v: d.ca ? d.marge / d.ca : 0 },
  }));
  return (
    <>
      <Entete titre="Finance" question="Combien gagnons-nous, où, et les chiffres de facturation et de comptabilité concordent-ils ?" ctx={ctx} segments={false} />
      <div className="grille">
        <Kpi titre="CA comptable" valeur={euros(m.ca)} delta={{ ratio: null, libelle: "pas de comptabilité N-1" }} aide="Produits de la classe 1 des écritures comptables." classe="c3" />
        <Kpi titre="Marge brute (provisoire)" valeur={euros(m.marge)} aide="CA comptable moins achats (classe 2). Les charges directes comme la sous-traitance ne sont pas retirées : définition à confirmer." classe="c3" />
        <Kpi titre="Taux de marge brute" valeur={pct(taux, 1)} classe="c3" />
        <Kpi titre="Solde produits moins charges" valeur={euros(solde)} detail="Sur les écritures fournies, hors périmètre complet à confirmer" aide="Somme de tous les produits et charges des écritures reçues. Ce n'est pas un résultat comptable validé." classe="c3" />
        <Tuile titre="Du CA au solde" sousTitre="Produits et charges par nature, sur la période" classe="c7">
          <Graphique option={optionPont(ca, solde, "CA", "Solde", elements)} titre="Du CA au solde" hauteur={340} />
        </Tuile>
        <Tuile titre="Marge par domaine" sousTitre="Marge brute et taux de marge" aide="Les achats ne sont pas tous rattachés à un domaine : le taux par domaine est indicatif et peut atteindre 100 % quand aucun achat n'est affecté." classe="c5">
          <Graphique option={optionDomaines} titre="Marge brute par domaine" hauteur={340} />
        </Tuile>
        <Tuile titre="Marge brute et taux par mois" sousTitre="Mois comptable" classe="c8">
          <Graphique option={optionMarge} titre="Marge brute et taux par mois" hauteur={320} />
        </Tuile>
        <Tuile titre="Facturation contre comptabilité" sousTitre="Contrôle de cohérence mensuel" aide="Le CA facturé vient des factures de vente (mois Sage), le CA comptable des écritures de produits. Un écart persistant signale un décalage de rattachement." classe="c4">
          <Graphique option={optionRapprochement} titre="CA facturé et CA comptable par mois" hauteur={320} />
        </Tuile>
        <Tuile titre="Produits et charges par nature" classe="c6" plein>
          <TableauDonnees nomExport="produits_charges" recherche={false} colonnes={[{ cle: "classe", libelle: "Nature" }, { cle: "montant", libelle: "Montant", num: true }, { cle: "part", libelle: "Part du CA", num: true }]} lignes={tableau} />
        </Tuile>
        <Tuile titre="Marge par domaine" classe="c6" plein>
          <TableauDonnees
            nomExport="marge_par_domaine"
            recherche={false}
            colonnes={[
              { cle: "domaine", libelle: "Domaine" },
              { cle: "ca", libelle: "CA comptable", num: true },
              { cle: "achats", libelle: "Achats", num: true },
              { cle: "marge", libelle: "Marge brute", num: true },
              { cle: "taux", libelle: "Taux", num: true },
            ]}
            lignes={tableauDomaines}
            triInitial={{ cle: "marge", sens: "desc" }}
          />
        </Tuile>
      </div>
      <p className="note-bas">
        Les écritures comptables couvrent {m.premierMois ? libellePeriode(m.premierMois) : "—"} à {m.dernierMois ? libellePeriode(m.dernierMois) : "—"}. Évolution du CA comptable non calculable faute d&apos;export 2025.
        {variation(0) ? "" : ""}
      </p>
    </>
  );
}
