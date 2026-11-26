import Link from "next/link";
import { notFound } from "next/navigation";
import { Graphique } from "@/components/charts/Graphique";
import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { TableauDonnees, type Ligne } from "@/components/ui/TableauDonnees";
import { Tuile } from "@/components/ui/Tuile";
import { client360, portefeuille } from "@/lib/comex";
import { lireContexte } from "@/lib/contexte";
import type { ParamsUrl } from "@/lib/filtres";
import { euros, libellePeriode, pct, variation } from "@/lib/format";
import { couleurPour, optionBarresHorizontales, optionSeries } from "@/lib/graphiques";
import { libelleMode } from "@/lib/periode";
import { scoreClient } from "@/lib/score";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ParamsUrl> }) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) notFound();
  const ctx = await lireContexte(await searchParams);
  const [fiche, tous, score] = await Promise.all([client360(numero, ctx.f), portefeuille(ctx.f), scoreClient(numero)]);
  if (!fiche) notFound();
  const ligne = tous.find((l) => l.tiersId === numero);
  const rang = ligne ? [...tous].sort((a, b) => b.ca - a.ca).findIndex((l) => l.tiersId === numero) + 1 : null;
  const periodes = [...new Set(fiche.mensuel.map((m) => m.periode))].sort();
  const domaines = [...new Set(fiche.mensuel.map((m) => m.domaine))];
  const optionMensuel = optionSeries(
    periodes.map(libellePeriode),
    domaines.map((d, i) => ({ nom: d, valeurs: periodes.map((p) => fiche.mensuel.find((m) => m.periode === p && m.domaine === d)?.ca ?? 0), couleur: couleurPour(d, i), empile: true })),
    { zoom: periodes.length > 14 },
  );
  const lignesOpps: Ligne[] = fiche.opportunites.map((o) => ({
    domaine: { t: o.domaine },
    etape: { t: o.etape },
    type: { t: o.typeAffaire },
    montant: { t: euros(o.montant), v: o.montant },
  }));
  return (
    <>
      <Entete
        titre={fiche.client}
        question={`${fiche.segment} · code ${fiche.code} · client depuis ${fiche.premier ? libellePeriode(fiche.premier) : "—"} · dernière facture ${fiche.dernier ? libellePeriode(fiche.dernier) : "—"}`}
        ctx={ctx}
        segments={false}
        domaines={false}
        actions={
          <Link href={`/clients?p=${ctx.fin}&mode=${ctx.mode}`} className="bouton-lien">
            ← Tous les clients
          </Link>
        }
      />
      <div className="grille">
        <Kpi
          titre={`CA · ${libelleMode(ctx.mode)}`}
          valeur={euros(ligne?.ca)}
          delta={ctx.comparable && ligne ? { ratio: ligne.variation, absolu: euros(ligne.ca - ligne.caN1) } : undefined}
          detail={rang ? `${rang}e client sur ${tous.length} · ${pct(ligne?.part, 1)} du CA` : undefined}
          classe="c3"
        />
        <Kpi titre="Créances échues" valeur={euros(ligne?.echu)} detail={ligne && ligne.echu30 > 0 ? `dont ${euros(ligne.echu30)} à plus de 30 jours` : "Aucun retard de plus de 30 jours"} classe="c3" />
        <Kpi titre="Risque de départ" valeur={score ? pct(score.probabilite_depart, 0) : "—"} detail={score ? `Niveau ${score.niveau}` : "Non scoré : client non récurrent"} classe="c3" />
        <Kpi
          titre="Dernière facture"
          valeur={ligne?.moisSansFacture ? `il y a ${ligne.moisSansFacture} mois` : "ce mois"}
          detail={ligne?.variation !== null && ligne?.variation !== undefined ? `Évolution : ${variation(ligne.variation)}` : undefined}
          classe="c3"
        />
        <Tuile titre="CA facturé par mois et par domaine" sousTitre="24 derniers mois" classe="c8">
          <Graphique option={optionMensuel} titre="CA du client par mois et par domaine" hauteur={320} />
        </Tuile>
        <Tuile titre="Ce que le client achète" sousTitre="Familles de produit sur la période" classe="c4">
          <Graphique option={optionBarresHorizontales(fiche.familles.map((x) => ({ libelle: x.famille, valeur: x.ca })))} titre="CA par famille de produit" hauteur={320} />
        </Tuile>
        <Tuile titre="Pourquoi ce niveau de risque" sousTitre="Chemin suivi dans l'arbre de décision" classe="c6" plein>
          {score ? (
            <TableauDonnees
              recherche={false}
              colonnes={[
                { cle: "critere", libelle: "Critère" },
                { cle: "valeur", libelle: "Valeur", num: true },
                { cle: "regle", libelle: "Règle" },
              ]}
              lignes={score.regles.map((r) => ({ critere: { t: r.variable }, valeur: { t: r.valeur.toLocaleString("fr-FR"), v: r.valeur }, regle: { t: r.condition } }))}
            />
          ) : (
            <p className="vide">Le modèle ne score que les clients récurrents (facturés dans au moins 4 des 6 derniers mois).</p>
          )}
        </Tuile>
        <Tuile titre="Créances ouvertes" classe="c3" plein>
          {fiche.echeances.length === 0 ? (
            <p className="vide">Aucune créance ouverte.</p>
          ) : (
            <TableauDonnees
              recherche={false}
              colonnes={[
                { cle: "retard", libelle: "Retard" },
                { cle: "nb", libelle: "Pièces", num: true },
                { cle: "solde", libelle: "Solde", num: true },
              ]}
              lignes={fiche.echeances.map((e) => ({ retard: { t: e.tranche }, nb: { t: String(e.nb), v: e.nb }, solde: { t: euros(e.solde), v: e.solde } }))}
            />
          )}
        </Tuile>
        <Tuile titre="Opportunités" classe="c3" plein>
          {lignesOpps.length === 0 ? (
            <p className="vide">Aucune opportunité rapprochée.</p>
          ) : (
            <TableauDonnees
              recherche={false}
              taille={6}
              colonnes={[
                { cle: "domaine", libelle: "Domaine" },
                { cle: "etape", libelle: "Étape" },
                { cle: "montant", libelle: "Montant", num: true },
              ]}
              lignes={lignesOpps}
            />
          )}
        </Tuile>
      </div>
    </>
  );
}
