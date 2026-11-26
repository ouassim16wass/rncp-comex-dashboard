import Link from "next/link";
import { Graphique } from "@/components/charts/Graphique";
import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { TableauDonnees, type Ligne } from "@/components/ui/TableauDonnees";
import { Tuile } from "@/components/ui/Tuile";
import { pipelineCarte } from "@/lib/analyses";
import { caDouzeMois, moisDisponibles, pipeline } from "@/lib/comex";
import type { ParamsUrl } from "@/lib/filtres";
import { euros, libelleDate, pct } from "@/lib/format";
import { optionBarresHorizontales, optionCarte, optionSeries } from "@/lib/graphiques";
import { maintenant } from "@/lib/maintenant";

export const dynamic = "force-dynamic";

const DIMENSIONS = [
  ["domaine", "Domaine"],
  ["commercial", "Commercial"],
  ["type_affaire", "Type d'affaire"],
] as const;

export default async function Page({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const params = await searchParams;
  const gd = Array.isArray(params.gd) ? params.gd[0] : params.gd;
  const dimension = gd === "commercial" || gd === "type_affaire" ? gd : "domaine";
  const mois = await moisDisponibles();
  const [p, carte, ca12] = await Promise.all([pipeline(dimension), pipelineCarte(), caDouzeMois(mois[mois.length - 2])]);
  const age = p.photo ? Math.floor((maintenant().getTime() - new Date(p.photo).getTime()) / 86_400_000) : null;
  const ORDRE_ETAPES = ["A venir", "En cours", "Envoyée", "Proposition en attente de validation"];
  const ouvertes = p.parEtape
    .filter((e) => !["Fermée", "Abandon projet client"].includes(e.etape))
    .sort((a, b) => (ORDRE_ETAPES.indexOf(a.etape) + 99) % 99 - (ORDRE_ETAPES.indexOf(b.etape) + 99) % 99);
  const domaines = [...new Set(carte.map((c) => c.domaine))].sort();
  const etapes = [...new Set(carte.map((c) => c.etape))];
  const valeursCarte: [number, number, number][] = carte.map((c) => [etapes.indexOf(c.etape), domaines.indexOf(c.domaine), Math.round(c.montant)]);
  const gain = p.gain.slice(0, 12);
  const optionGain = optionSeries(
    gain.map((g) => (dimension === "commercial" ? `Commercial ${g.membre}` : g.membre)),
    [
      { nom: "Gagnées", valeurs: gain.map((g) => g.gagnees), couleur: "#5bc500", empile: true },
      { nom: "Perdues", valeurs: gain.map((g) => g.perdues), couleur: "#d31205", empile: true },
      { nom: "Abandons et No Go", valeurs: gain.map((g) => g.abandons), couleur: "#aaaaaa", empile: true },
    ],
    {},
  );
  const tableauGain: Ligne[] = p.gain.map((g) => ({
    membre: { t: dimension === "commercial" ? `Commercial ${g.membre}` : g.membre },
    gagnees: { t: String(g.gagnees), v: g.gagnees },
    perdues: { t: String(g.perdues), v: g.perdues },
    abandons: { t: String(g.abandons), v: g.abandons },
    taux: { t: pct(g.ratio, 0), v: g.ratio ?? -1 },
    large: { t: pct(g.large, 0), v: g.large ?? -1 },
  }));
  const tableauTop: Ligne[] = p.top.map((o) => ({
    client: { t: o.client },
    domaine: { t: o.domaine },
    etape: { t: o.etape },
    type: { t: o.typeAffaire },
    montant: { t: euros(o.montant), v: o.montant },
  }));
  return (
    <>
      <Entete titre="Commercial" question="Que contient le pipeline, quel est notre taux de gain et où gagne-t-on ?" filtres={false} />
      {age !== null && age > 60 && p.photo && (
        <div className="avertissement" style={{ marginTop: 14 }}>
          Le pipeline date du {libelleDate(p.photo)}, soit {age} jours : les étapes ont pu évoluer depuis. Les comptes absents de Sage sont regroupés sous « Non rapproché ».
        </div>
      )}
      <div className="grille">
        <Kpi titre="Pipeline ouvert" valeur={euros(p.ouvert.montant)} detail={`${p.ouvert.nb.toLocaleString("fr-FR")} opportunités en cours`} aide="Opportunités ni fermées ni abandonnées à la date de photo." classe="c3" />
        <Kpi titre="Couverture du CA" valeur={ca12 > 0 ? `${(p.ouvert.montant / ca12).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ans` : "—"} detail="Pipeline ouvert rapporté au CA des 12 derniers mois" classe="c3" />
        <Kpi titre="Taux de gain" valeur={pct(p.gainTotal.ratio, 0)} detail="Gagnées sur gagnées et perdues" aide="Définition restreinte. Les abandons et les No Go ne sont pas comptés comme des échecs." classe="c3" />
        <Kpi titre="Taux de gain large" valeur={pct(p.gainTotal.large, 0)} detail={`${p.gainTotal.gagnees} gagnées · ${p.gainTotal.perdues} perdues · ${p.gainTotal.abandons} abandonnées`} aide="Définition large : abandons et No Go comptés comme des échecs. À valider avec la direction commerciale." classe="c3" />
        <Tuile titre="Pipeline ouvert par étape" sousTitre="Montant, de l'opportunité à venir à la proposition" classe="c4">
          <Graphique option={optionBarresHorizontales(ouvertes.map((e) => ({ libelle: e.etape, valeur: e.montant, couleur: "#008ae0" })), { nom: "Montant" })} titre="Pipeline ouvert par étape" hauteur={320} />
        </Tuile>
        <Tuile
          titre="Gagné, perdu, abandonné"
          sousTitre="Nombre d'opportunités clôturées"
          classe="c4"
          actions={
            <div className="bascule" role="group" aria-label="Axe d'analyse">
              {DIMENSIONS.map(([cle, libelle]) => (
                <Link key={cle} href={`/commercial?gd=${cle}`} aria-pressed={dimension === cle}>
                  {libelle}
                </Link>
              ))}
            </div>
          }
        >
          <Graphique option={optionGain} format="nombre" titre="Opportunités gagnées, perdues et abandonnées" hauteur={320} />
        </Tuile>
        <Tuile titre="Où est le pipeline" sousTitre="Montant ouvert par domaine et étape" classe="c4">
          <Graphique option={optionCarte(domaines, etapes, valeursCarte, Math.max(...valeursCarte.map((v) => v[2]), 1))} titre="Pipeline ouvert par domaine et étape" hauteur={320} />
        </Tuile>
        <Tuile titre="Taux de gain" classe="c6" plein>
          <TableauDonnees
            nomExport="taux_de_gain"
            recherche={false}
            colonnes={[
              { cle: "membre", libelle: DIMENSIONS.find(([c]) => c === dimension)?.[1] ?? "" },
              { cle: "gagnees", libelle: "Gagnées", num: true },
              { cle: "perdues", libelle: "Perdues", num: true },
              { cle: "abandons", libelle: "Abandons", num: true },
              { cle: "taux", libelle: "Taux", num: true },
              { cle: "large", libelle: "Large", num: true },
            ]}
            lignes={tableauGain}
            triInitial={{ cle: "gagnees", sens: "desc" }}
          />
        </Tuile>
        <Tuile titre="Plus grosses opportunités ouvertes" classe="c6" plein>
          <TableauDonnees
            nomExport="opportunites_ouvertes"
            colonnes={[
              { cle: "client", libelle: "Compte" },
              { cle: "domaine", libelle: "Domaine" },
              { cle: "etape", libelle: "Étape" },
              { cle: "type", libelle: "Type" },
              { cle: "montant", libelle: "Montant", num: true },
            ]}
            lignes={tableauTop}
            taille={8}
            triInitial={{ cle: "montant", sens: "desc" }}
          />
        </Tuile>
      </div>
    </>
  );
}
