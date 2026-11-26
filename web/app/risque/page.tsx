import { Graphique } from "@/components/charts/Graphique";
import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { TableauDonnees, type Ligne } from "@/components/ui/TableauDonnees";
import { Tuile } from "@/components/ui/Tuile";
import { euros, libellePeriode, pct } from "@/lib/format";
import { optionNuage } from "@/lib/graphiques";
import { infoModele, listeScores, synthese } from "@/lib/score";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [resume, clients, modele] = await Promise.all([synthese(), listeScores(), infoModele()]);
  if (!resume || clients.length === 0) {
    return (
      <>
        <Entete titre="Risque clients" question="Quels clients risquent de ne plus être facturés ?" filtres={false} />
        <div className="avertissement" style={{ marginTop: 14 }}>L&apos;API de score ne répond pas. Vérifiez que le service est démarré.</div>
      </>
    );
  }
  const arbre = modele?.evaluation.find((e) => e.modele === "Arbre de décision");
  const regle = modele?.evaluation.find((e) => e.modele === "Règle simple");
  const points = clients.map((c) => ({
    nom: `${c.nom} · ${euros(c.ca_annuel)} · ${pct(c.probabilite_depart, 0)}`,
    x: Math.max(c.ca_annuel, 1000),
    y: Math.max(c.probabilite_depart, 0.0005),
    taille: Math.max(8, Math.min(30, Math.sqrt(c.ca_annuel) / 25)),
    groupe: c.niveau === "élevé" ? "Élevé" : c.niveau === "moyen" ? "Moyen" : "Faible",
  }));
  const surveilles = clients.filter((c) => c.niveau !== "faible");
  const tableau: Ligne[] = surveilles.map((c) => ({
    client: { t: c.nom, href: `/clients/${c.tiers_id}` },
    niveau: { t: c.niveau, classe: c.niveau === "élevé" ? "ton-mauvais" : "ton-alerte" },
    proba: { t: pct(c.probabilite_depart, 0), v: c.probabilite_depart },
    ca: { t: euros(c.ca_annuel), v: c.ca_annuel },
  }));
  return (
    <>
      <Entete titre="Risque clients" question="Quels clients récurrents risquent de ne plus être facturés dans les 3 mois ?" filtres={false} />
      <div className="grille">
        {(["élevé", "moyen", "faible"] as const).map((n) => (
          <Kpi
            key={n}
            titre={`Risque ${n}`}
            valeur={`${resume.niveaux[n].clients} clients`}
            detail={`${euros(resume.niveaux[n].ca_annuel)} de CA annualisé · ${pct(resume.niveaux[n].part_du_ca, 1)} du CA`}
            classe="c4"
          />
        ))}
        <Tuile titre="Qui risque de partir" sousTitre={`Chaque bulle est un client : CA annualisé et probabilité de départ (échelles logarithmiques) · situation à ${resume.periode ? libellePeriode(resume.periode) : "—"}`} classe="c8">
          <Graphique
            option={optionNuage(
              points,
              [
                { nom: "Élevé", couleur: "#d31205" },
                { nom: "Moyen", couleur: "#ffc844" },
                { nom: "Faible", couleur: "#5bc500" },
              ],
              { x: "CA annualisé", y: "Probabilité de départ", logX: true, logY: true },
            )}
            titre="Clients selon leur CA et leur probabilité de départ"
            hauteur={380}
          />
        </Tuile>
        <Tuile titre="Fiabilité du modèle" sousTitre="Arbre de décision, évalué sur des mois jamais vus à l'entraînement" classe="c4">
          <ul className="limites">
            <li>
              Capacité à classer les clients : <strong>{arbre ? arbre.auc.toFixed(2) : "—"}</strong> (AUC) contre <strong>{regle ? regle.auc.toFixed(2) : "—"}</strong> pour une règle simple.
            </li>
            <li>
              Parmi les 10 % de clients les plus à risque, <strong>{arbre ? pct(arbre.precision_precision_10pct, 0) : "—"}</strong> partent réellement, contre {modele ? pct(modele.taux_de_base, 1) : "—"} en moyenne.
            </li>
            <li>Peu de départs observés à l&apos;entraînement : le modèle reste fragile. Un client qui facture à un rythme irrégulier peut être signalé sans partir.</li>
          </ul>
        </Tuile>
        <Tuile titre="Clients à surveiller" sousTitre="Risque élevé et moyen" classe="c12" plein>
          <TableauDonnees
            nomExport="clients_a_risque"
            colonnes={[
              { cle: "client", libelle: "Client" },
              { cle: "niveau", libelle: "Niveau" },
              { cle: "proba", libelle: "Probabilité de départ", num: true },
              { cle: "ca", libelle: "CA annualisé", num: true },
            ]}
            lignes={tableau}
            taille={12}
            triInitial={{ cle: "proba", sens: "desc" }}
          />
        </Tuile>
      </div>
    </>
  );
}
