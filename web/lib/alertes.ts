import { euros, pct } from "./format";

export type Niveau = "alerte" | "attention" | "info" | "positif";

export type Alerte = { niveau: Niveau; titre: string; detail: string; lien?: string };

export const SEUILS = {
  baisseCA: -0.05,
  hausseCA: 0.05,
  baisseDomaine: -0.15,
  poidsMinDomaine: 0.02,
  top1: 0.15,
  top5: 0.4,
  groupe: 0.7,
  clientsPerdus: 0.03,
  creances30: 0.2,
  agePhotoCreancesJours: 30,
  agePhotoPipelineJours: 60,
  ecartComptable: 0.15,
  expositionRisque: 0.05,
};

export type EntreeAlertes = {
  ca: number;
  caN1: number;
  libelleFenetre: string;
  domaines: { membre: string; ca: number; caN1: number }[];
  top1: number;
  top5: number;
  partGroupe: number | null;
  perdus: { nb: number; ca: number };
  nouveaux: { nb: number; ca: number };
  creances: { total: number; echu30: number; photo: string | null };
  pipelinePhoto: string | null;
  ecartComptable: number | null;
  risque: { eleves: number; moyens: number; partCA: number; partCAMoyen: number } | null;
  derive?: { psiMax: number; statut: "ok" | "attention" | "alerte" } | null;
  aujourdhui: Date;
};

const jours = (photo: string | null, ref: Date) => (photo ? Math.floor((ref.getTime() - new Date(photo).getTime()) / 86_400_000) : null);

export function construireAlertes(e: EntreeAlertes): Alerte[] {
  const sortie: Alerte[] = [];
  const variation = e.caN1 > 0 ? e.ca / e.caN1 - 1 : null;
  if (variation !== null) {
    const signe = variation > 0 ? "+" : "";
    if (variation <= SEUILS.baisseCA)
      sortie.push({
        niveau: "alerte",
        titre: `CA en baisse de ${pct(Math.abs(variation), 1)} sur un an`,
        detail: `${euros(e.ca)} sur la période (${e.libelleFenetre}) contre ${euros(e.caN1)} un an plus tôt, soit ${euros(e.ca - e.caN1)}.`,
        lien: "/clients",
      });
    else if (variation >= SEUILS.hausseCA)
      sortie.push({
        niveau: "positif",
        titre: `CA en hausse de ${signe}${pct(variation, 1)} sur un an`,
        detail: `${euros(e.ca)} sur la période (${e.libelleFenetre}) contre ${euros(e.caN1)} un an plus tôt.`,
      });
  }
  const totalN1 = e.caN1 || 1;
  for (const d of e.domaines) {
    if (d.caN1 <= 0) continue;
    const v = d.ca / d.caN1 - 1;
    if (v <= SEUILS.baisseDomaine && d.caN1 / totalN1 >= SEUILS.poidsMinDomaine)
      sortie.push({
        niveau: "attention",
        titre: `Domaine ${d.membre} en baisse de ${pct(Math.abs(v), 0)}`,
        detail: `${euros(d.ca - d.caN1)} par rapport à l'an dernier, pour un domaine qui pesait ${pct(d.caN1 / totalN1, 0)} du CA.`,
        lien: `/ventes?l=domaine&f_domaine=${encodeURIComponent(d.membre)}`,
      });
  }
  if (e.top1 >= SEUILS.top1 || e.top5 >= SEUILS.top5)
    sortie.push({
      niveau: "attention",
      titre: "Forte concentration du CA",
      detail: `Le premier client pèse ${pct(e.top1, 0)} du CA et les 5 premiers ${pct(e.top5, 0)}. Seuils d'attention : ${pct(SEUILS.top1, 0)} et ${pct(SEUILS.top5, 0)}.`,
      lien: "/clients",
    });
  if (e.partGroupe !== null && e.partGroupe >= SEUILS.groupe)
    sortie.push({
      niveau: "info",
      titre: `${pct(e.partGroupe, 0)} du CA vient du groupe actionnaire`,
      detail: "Dépendance au groupe : à suivre dans le temps et par domaine.",
      lien: "/ventes?l=segment&c=domaine&v=part",
    });
  if (e.caN1 > 0 && e.perdus.ca / e.caN1 >= SEUILS.clientsPerdus)
    sortie.push({
      niveau: "attention",
      titre: `${e.perdus.nb} clients facturés l'an dernier ne le sont plus`,
      detail: `Ils représentaient ${euros(e.perdus.ca)} de CA, soit ${pct(e.perdus.ca / e.caN1, 1)} de la période comparée. Les nouveaux clients apportent ${euros(e.nouveaux.ca)} (${e.nouveaux.nb} clients).`,
      lien: "/clients?statut=perdu",
    });
  if (e.creances.total > 0 && e.creances.echu30 / e.creances.total >= SEUILS.creances30)
    sortie.push({
      niveau: "alerte",
      titre: `${pct(e.creances.echu30 / e.creances.total, 0)} des créances ont plus de 30 jours de retard`,
      detail: `${euros(e.creances.echu30)} sur ${euros(e.creances.total)} de créances ouvertes.`,
      lien: "/tresorerie",
    });
  const agePhoto = jours(e.creances.photo, e.aujourdhui);
  if (agePhoto !== null && agePhoto > SEUILS.agePhotoCreancesJours)
    sortie.push({
      niveau: "attention",
      titre: `Créances arrêtées il y a ${agePhoto} jours`,
      detail: "La dernière extraction des échéances est ancienne : les montants ne reflètent pas la situation du jour.",
      lien: "/qualite",
    });
  const agePipeline = jours(e.pipelinePhoto, e.aujourdhui);
  if (agePipeline !== null && agePipeline > SEUILS.agePhotoPipelineJours)
    sortie.push({
      niveau: "attention",
      titre: `Pipeline arrêté il y a ${agePipeline} jours`,
      detail: "La dernière extraction Salesforce est ancienne : le pipeline ouvert peut avoir changé.",
      lien: "/qualite",
    });
  if (e.ecartComptable !== null && Math.abs(e.ecartComptable) >= SEUILS.ecartComptable)
    sortie.push({
      niveau: "info",
      titre: `Écart de ${pct(Math.abs(e.ecartComptable), 0)} entre CA facturé et CA comptable`,
      detail: "Sur le dernier mois comptable disponible. Le rattachement des factures aux mois peut différer entre facturation et comptabilité.",
      lien: "/finance",
    });
  if (e.risque && e.risque.eleves > 0)
    sortie.push({
      niveau: e.risque.partCA >= SEUILS.expositionRisque ? "alerte" : "info",
      titre: `${e.risque.eleves} clients à risque de départ élevé`,
      detail: `Ils représentent ${pct(e.risque.partCA, 1)} du CA annualisé : ${e.risque.partCA >= SEUILS.expositionRisque ? "exposition significative" : "le risque touche surtout de petits clients"}.`,
      lien: "/risque",
    });
  else if (e.risque && e.risque.moyens > 0)
    sortie.push({
      niveau: "info",
      titre: `${e.risque.moyens} clients à risque de départ moyen`,
      detail: `Aucun client n'atteint le niveau élevé ; ${e.risque.moyens} clients (${pct(e.risque.partCAMoyen, 1)} du CA annualisé) dépassent 10 % de probabilité de départ.`,
      lien: "/risque",
    });
  if (e.derive && e.derive.statut !== "ok")
    sortie.push({
      niveau: e.derive.statut === "alerte" ? "attention" : "info",
      titre: "Le modèle de risque dérive",
      detail: `Indice de dérive maximal de ${e.derive.psiMax.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} : les clients actuels ne ressemblent plus à ceux de l'entraînement, les scores sont à prendre avec prudence.`,
      lien: "/modele",
    });
  const ordre: Record<Niveau, number> = { alerte: 0, attention: 1, info: 2, positif: 3 };
  return sortie.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
}
