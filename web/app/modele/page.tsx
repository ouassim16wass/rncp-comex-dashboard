import { Graphique } from "@/components/charts/Graphique";
import { Entete } from "@/components/ui/Entete";
import { Kpi } from "@/components/ui/Kpi";
import { TableauDonnees, type Ligne } from "@/components/ui/TableauDonnees";
import { Tuile } from "@/components/ui/Tuile";
import { pct } from "@/lib/format";
import { optionBarresHorizontales } from "@/lib/graphiques";
import { infoModele, registreModeles, surveillance, synthese } from "@/lib/score";

export const dynamic = "force-dynamic";

const COULEURS = { ok: "#5bc500", attention: "#ffc844", alerte: "#d31205" } as const;
const CLASSE_STATUT: Record<string, string> = { production: "ton-bon", archive: "", refuse: "ton-mauvais", candidat: "ton-alerte" };

export default async function Page() {
  const [modele, registre, suivi, resume] = await Promise.all([infoModele(), registreModeles(), surveillance(), synthese()]);
  if (!modele) {
    return (
      <>
        <Entete titre="Suivi du modèle" question="Le modèle en production est-il toujours fiable ?" filtres={false} />
        <div className="avertissement" style={{ marginTop: 14 }}>L&apos;API de score ne répond pas.</div>
      </>
    );
  }
  const mesures = suivi?.mesures ?? [];
  const psi = mesures.filter((m) => m.indicateur.startsWith("psi:") && m.valeur !== null);
  const psiMax = mesures.find((m) => m.indicateur === "psi_max");
  const reel = mesures.find((m) => m.indicateur === "auc_realise");
  const arbre = modele.evaluation.find((e) => e.modele === "Arbre de décision");
  const regle = modele.evaluation.find((e) => e.modele === "Règle simple");
  const derive = psiMax?.statut === "alerte";
  const lignesRegistre: Ligne[] = (registre?.historique ?? []).map((h) => ({
    version: { t: h.version },
    date: { t: h.date.replace("T", " ").slice(0, 16) },
    statut: { t: h.statut, classe: CLASSE_STATUT[h.statut] ?? "" },
    raison: { t: h.raison || "—" },
  }));
  const lignesEval: Ligne[] = modele.evaluation.map((e) => ({
    modele: { t: e.modele },
    auc: { t: `${e.auc.toFixed(2)} (${e.auc_ic95[0].toFixed(2)} à ${e.auc_ic95[1].toFixed(2)})`, v: e.auc },
    ap: { t: e.ap.toFixed(2), v: e.ap },
    rappel: { t: pct(e.rappel_10pct, 0), v: e.rappel_10pct },
    precision: { t: pct(e.precision_precision_10pct, 0), v: e.precision_precision_10pct },
  }));
  return (
    <>
      <Entete titre="Suivi du modèle" question="Le modèle en production est-il toujours fiable, et que s'est-il passé depuis son entraînement ?" filtres={false} />
      {derive && (
        <div className="avertissement" style={{ marginTop: 14 }}>
          <strong>Dérive forte détectée.</strong> Les clients récurrents d&apos;aujourd&apos;hui ne ressemblent plus à ceux de l&apos;entraînement : ils sont facturés moins régulièrement. Les scores restent calculés, mais ils sont probablement
          optimistes. Un réentraînement sur les mois récents est à envisager dès que les départs de cette période sont observables.
        </div>
      )}
      <div className="grille">
        <Kpi
          titre="Modèle en production"
          valeur={modele.version?.slice(0, 9) ?? "—"}
          detail={`${modele.date_creation ? modele.date_creation.replace("T", " ").slice(0, 16) : "—"} · commit ${modele.commit_git ?? "inconnu"}`}
          aide="Version enregistrée dans le registre de modèles : date d'entraînement et commit du code qui l'a produit."
          classe="c3"
        />
        <Kpi
          titre="Capacité à classer (AUC)"
          valeur={arbre ? arbre.auc.toFixed(2) : "—"}
          detail={regle ? `contre ${regle.auc.toFixed(2)} pour la règle simple` : undefined}
          aide="Mesurée sur des mois jamais vus à l'entraînement. 0,5 correspond au hasard, 1 à un classement parfait."
          classe="c3"
        />
        <Kpi
          titre="Dérive maximale"
          valeur={psiMax?.valeur !== null && psiMax ? psiMax.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "—"}
          delta={{ ratio: null, libelle: psiMax ? (psiMax.statut === "ok" ? "stable" : psiMax.statut === "attention" ? "à surveiller" : "dérive forte") : "aucune mesure" }}
          aide="Indice de stabilité de population : moins de 0,1 stable, de 0,1 à 0,25 à surveiller, au-delà dérive forte. Comparaison entre les clients d'aujourd'hui et ceux de l'entraînement."
          classe="c3"
        />
        <Kpi
          titre="Performance réalisée"
          valeur={reel ? (reel.valeur ?? 0).toFixed(2) : "à venir"}
          detail={reel ? reel.detail : `${suivi?.instantanes_conserves ?? 0} instantané(s) de scores conservé(s) : il faut 3 mois pour savoir qui est réellement parti`}
          aide="AUC des scores passés, mesurée une fois que l'on sait si le client est parti. Elle n'est calculable qu'après trois mois."
          classe="c3"
        />
        <Tuile titre="Dérive par variable" sousTitre="Clients d'aujourd'hui comparés à ceux de l'entraînement" aide="Vert : stable (moins de 0,1). Jaune : à surveiller. Rouge : dérive forte (plus de 0,25)." classe="c7">
          {psi.length === 0 ? (
            <p className="vide">Aucune mesure : lancez la surveillance du modèle.</p>
          ) : (
            <Graphique
              option={optionBarresHorizontales(
                [...psi]
                  .sort((a, b) => (b.valeur ?? 0) - (a.valeur ?? 0))
                  .map((m) => ({ libelle: m.detail, valeur: m.valeur ?? 0, couleur: COULEURS[m.statut] })),
                { nom: "Indice de dérive" },
              )}
              format="decimal"
              titre="Dérive de chaque variable du modèle"
              hauteur={360}
            />
          )}
        </Tuile>
        <Tuile titre="Clients scorés" sousTitre="Répartition par niveau de risque" classe="c5">
          {resume ? (
            <table className="tableau">
              <thead>
                <tr>
                  <th>Niveau</th>
                  <th className="num">Clients</th>
                  <th className="num">Part du CA</th>
                </tr>
              </thead>
              <tbody>
                {(["élevé", "moyen", "faible"] as const).map((n) => (
                  <tr key={n}>
                    <td>{n}</td>
                    <td className="num">{resume.niveaux[n].clients}</td>
                    <td className="num">{pct(resume.niveaux[n].part_du_ca, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="vide">Indisponible.</p>
          )}
          <p className="note-bas">
            Seuils : élevé à partir de {pct(modele.seuils.eleve, 0)}, moyen à partir de {pct(modele.seuils.moyen, 0)} de départ observés dans les cas semblables à l&apos;entraînement.
          </p>
          <p className="note-bas">
            Journaux, métriques et alertes détaillés dans Grafana (poste local : <a href="http://localhost:3200">localhost:3200</a>).
          </p>
        </Tuile>
        <Tuile titre="Résultats d'évaluation" sousTitre={modele.test ? `Période de test : ${modele.test.observations} observations, ${modele.test.departs} départs` : ""} classe="c6" plein>
          <TableauDonnees
            recherche={false}
            colonnes={[
              { cle: "modele", libelle: "Modèle" },
              { cle: "auc", libelle: "AUC (intervalle à 95 %)", num: true },
              { cle: "ap", libelle: "Précision moyenne", num: true },
              { cle: "rappel", libelle: "Départs détectés (top 10 %)", num: true },
              { cle: "precision", libelle: "Précision (top 10 %)", num: true },
            ]}
            lignes={lignesEval}
          />
        </Tuile>
        <Tuile titre="Registre des modèles" sousTitre="Chaque entraînement est versionné ; seul un modèle qui franchit la porte qualité passe en production" classe="c6" plein>
          <TableauDonnees
            recherche={false}
            taille={6}
            colonnes={[
              { cle: "version", libelle: "Version" },
              { cle: "date", libelle: "Date" },
              { cle: "statut", libelle: "Statut" },
              { cle: "raison", libelle: "Décision" },
            ]}
            lignes={lignesRegistre}
          />
        </Tuile>
      </div>
    </>
  );
}
