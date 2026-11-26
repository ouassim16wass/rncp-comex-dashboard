import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { TableauDonnees, type Ligne } from "@/components/ui/TableauDonnees";
import { Tuile } from "@/components/ui/Tuile";
import { controlesCubes, couverture, executions } from "@/lib/comex";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const LIBELLES: Record<string, string> = {
  pyspark_ca: "CA facturé (Sage)",
  pyspark_marge: "Écritures de marge (Sage)",
  pyspark_echeances_clients: "Créances clients (Sage)",
  pyspark_echeances_fournisseurs: "Dettes fournisseurs (Sage)",
  pyspark_opportunites: "Opportunités (Salesforce)",
  pyspark_tickets: "Tickets (iTop)",
};

const euro2 = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const TOLERANCE = 0.05;

export default async function Page() {
  const [exec, couv, cubes] = await Promise.all([executions(), couverture(), controlesCubes()]);
  const lignesMontants = exec.filter((e) => e.sommeBrute !== null);
  const cubeDe = (etape: string) => (etape === "pyspark_ca" ? cubes.pyspark_ca : etape === "pyspark_marge" ? cubes.pyspark_marge : etape === "pyspark_opportunites" ? cubes.pyspark_opportunites : null);
  const controles = lignesMontants.map((e) => {
    const rejete = (e.sommeBrute ?? 0) - (e.sommeStaging ?? 0);
    const ecartEntrepot = (e.sommeStaging ?? 0) - (e.sommeEntrepot ?? 0);
    const cube = cubeDe(e.etape);
    const ecartCube = cube ? cube.entrepot - cube.cube : null;
    const ok = Math.abs(ecartEntrepot) <= TOLERANCE && (ecartCube === null || Math.abs(ecartCube) <= TOLERANCE);
    return { e, rejete, ecartEntrepot, ecartCube, ok };
  });
  const toutOk = controles.length > 0 && controles.every((c) => c.ok);
  const lignes: Ligne[] = controles.map(({ e, rejete, ecartEntrepot, ecartCube, ok }) => ({
    source: { t: LIBELLES[e.etape] ?? e.etape },
    mesure: { t: e.mesure ?? "" },
    brute: { t: euro2(e.sommeBrute), v: e.sommeBrute },
    rejete: { t: euro2(rejete), v: rejete },
    staging: { t: euro2(e.sommeStaging), v: e.sommeStaging },
    entrepot: { t: euro2(e.sommeEntrepot), v: e.sommeEntrepot },
    ecart1: { t: euro2(ecartEntrepot), v: ecartEntrepot, classe: Math.abs(ecartEntrepot) <= TOLERANCE ? "ton-bon" : "ton-mauvais" },
    ecart2: { t: ecartCube === null ? "—" : euro2(ecartCube), v: ecartCube ?? 0, classe: ecartCube === null || Math.abs(ecartCube) <= TOLERANCE ? "ton-bon" : "ton-mauvais" },
    statut: { t: ok ? "Concordant" : "Écart", classe: ok ? "ton-bon" : "ton-mauvais" },
  }));
  const lignesExec: Ligne[] = exec.map((e) => ({
    source: { t: LIBELLES[e.etape] ?? e.etape },
    date: { t: e.debut },
    statut: { t: e.statut, classe: e.statut === "ok" ? "ton-bon" : e.statut === "alerte" ? "ton-alerte" : "ton-mauvais" },
    lues: { t: e.lues.toLocaleString("fr-FR"), v: e.lues },
    chargees: { t: e.chargees.toLocaleString("fr-FR"), v: e.chargees },
    rejetees: { t: e.rejetees.toLocaleString("fr-FR"), v: e.rejetees },
    taux: { t: pct(e.tauxRejet, 2), v: e.tauxRejet },
    duree: { t: `${e.dureeS.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} s`, v: e.dureeS },
  }));
  const lignesCouv: Ligne[] = couv.map((c) => ({ jeu: { t: c.jeu }, debut: { t: c.debut }, fin: { t: c.fin }, lignes: { t: c.lignes.toLocaleString("fr-FR"), v: c.lignes } }));
  return (
    <>
      <Entete titre="Fiabilité des données" question="Peut-on s'appuyer sur ces chiffres ? D'où viennent-ils, sont-ils complets, que ne couvrent-ils pas ?" filtres={false} />
      <div className="grille">
        <Kpi
          titre="Rapprochement des montants"
          valeur={controles.length === 0 ? "—" : toutOk ? "Concordant" : "Écart détecté"}
          detail={controles.length === 0 ? "Relancez les chargements pour enregistrer les sommes de contrôle" : `${controles.length} sources contrôlées au centime près`}
          aide="Pour chaque source, la somme des montants de l'extraction est comparée à celle de l'entrepôt, puis à celle des tables lues par le dashboard."
          classe="c4"
        />
        <Kpi titre="Lignes rejetées" valeur={exec.reduce((t, e) => t + e.rejetees, 0).toLocaleString("fr-FR")} detail="Un chargement est refusé au-delà de 1 % de rejet" aide="Lignes de l'extraction qui ne respectent pas le contrat de données." classe="c4" />
        <Kpi titre="Sources chargées" valeur={`${exec.filter((e) => e.statut !== "echec").length} sur ${exec.length}`} detail="Dernière exécution de chaque chargement" classe="c4" />
        <Tuile
          titre="Chaîne de contrôle des montants"
          sousTitre="Extraction → staging → entrepôt → tables du dashboard"
          aide="Le montant rejeté est la différence entre l'extraction et le staging. Les deux écarts doivent valoir 0,00 € : entrepôt contre staging, et tables du dashboard contre entrepôt."
          classe="c12"
          plein
        >
          {lignes.length === 0 ? (
            <p className="vide">Aucune somme de contrôle enregistrée.</p>
          ) : (
            <TableauDonnees
              recherche={false}
              nomExport="controle_montants"
              colonnes={[
                { cle: "source", libelle: "Source" },
                { cle: "mesure", libelle: "Mesure" },
                { cle: "brute", libelle: "Extraction", num: true },
                { cle: "rejete", libelle: "Rejeté", num: true },
                { cle: "staging", libelle: "Staging", num: true },
                { cle: "entrepot", libelle: "Entrepôt", num: true },
                { cle: "ecart1", libelle: "Écart entrepôt", num: true },
                { cle: "ecart2", libelle: "Écart dashboard", num: true },
                { cle: "statut", libelle: "Résultat" },
              ]}
              lignes={lignes}
            />
          )}
        </Tuile>
        <Tuile titre="Derniers chargements" sousTitre="Contrôles du contrat de données" classe="c7" plein>
          <TableauDonnees
            recherche={false}
            nomExport="chargements"
            colonnes={[
              { cle: "source", libelle: "Source" },
              { cle: "date", libelle: "Date" },
              { cle: "statut", libelle: "Statut" },
              { cle: "lues", libelle: "Lues", num: true },
              { cle: "chargees", libelle: "Chargées", num: true },
              { cle: "rejetees", libelle: "Rejetées", num: true },
              { cle: "taux", libelle: "Rejet", num: true },
              { cle: "duree", libelle: "Durée", num: true },
            ]}
            lignes={lignesExec}
          />
        </Tuile>
        <Tuile titre="Couverture dans le temps" classe="c5" plein>
          <TableauDonnees
            recherche={false}
            nomExport="couverture"
            colonnes={[
              { cle: "jeu", libelle: "Jeu de données" },
              { cle: "debut", libelle: "Du" },
              { cle: "fin", libelle: "Au" },
              { cle: "lignes", libelle: "Lignes", num: true },
            ]}
            lignes={lignesCouv}
          />
        </Tuile>
        <Tuile titre="Ce que ces données ne permettent pas encore" classe="c12">
          <ul className="limites">
            <li>
              <strong>Pas de budget ni d&apos;objectifs</strong> : on compare à l&apos;an dernier, pas à un plan. Un fichier de budget par mois et par domaine permettrait de mesurer l&apos;écart à l&apos;objectif.
            </li>
            <li>
              <strong>Pas de comptabilité de l&apos;année précédente</strong> : la marge ne peut pas être comparée à l&apos;an dernier. Les comparaisons sur 12 mois glissants ne sont possibles qu&apos;une fois douze mois de comptabilité disponibles.
            </li>
            <li>
              <strong>Un seul instantané</strong> des créances et du pipeline : pas d&apos;évolution de ces indicateurs tant que les extractions hebdomadaires ne s&apos;accumulent pas.
            </li>
            <li>
              <strong>Tickets sur quelques semaines seulement</strong>, et sans lien avec les clients faute de table de correspondance iTop vers Sage.
            </li>
            <li>
              <strong>Marge brute provisoire</strong> : le périmètre des charges directes est à confirmer avec la direction financière. Le « solde produits moins charges » n&apos;est pas un résultat comptable validé.
            </li>
            <li>
              <strong>Dernier mois partiel</strong> : exclu des analyses de facturation. Les avoirs peuvent rendre le CA « Build » négatif certains mois : la part Run et Build est alors calculée sur les montants positifs.
            </li>
          </ul>
        </Tuile>
      </div>
    </>
  );
}
