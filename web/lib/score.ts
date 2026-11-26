const URL_SCORE = process.env.API_SCORE_URL ?? "http://localhost:8120";
const CLE = process.env.API_CLE ?? "";

export type Niveau = "élevé" | "moyen" | "faible";

export type ClientRisque = {
  tiers_id: number;
  code_sage: string;
  nom: string;
  probabilite_depart: number;
  niveau: Niveau;
  ca_annuel: number;
  periode: number;
};

export type Synthese = {
  periode: number | null;
  clients_scores: number;
  niveaux: Record<Niveau, { clients: number; ca_annuel: number; part_du_ca: number }>;
};

export type Regle = { variable: string; valeur: number; condition: string };

async function appeler<T>(chemin: string): Promise<T | null> {
  try {
    const reponse = await fetch(`${URL_SCORE}${chemin}`, { headers: { "X-API-Key": CLE }, cache: "no-store" });
    if (!reponse.ok) return null;
    return (await reponse.json()) as T;
  } catch {
    return null;
  }
}

export const synthese = () => appeler<Synthese>("/synthese");

export const clientsRisque = (niveau: Niveau, limite = 50) =>
  appeler<{ total: number; clients: ClientRisque[] }>(
    `/scores?niveau=${encodeURIComponent(niveau)}&limite=${limite}`,
  );

export const scoreClient = (id: number) => appeler<ClientRisque & { regles: Regle[] }>(`/clients/${id}/score`);

export async function tousLesScores(): Promise<Map<number, { niveau: Niveau; probabilite: number }>> {
  const resultat = await appeler<{ clients: ClientRisque[] }>("/scores?limite=500");
  return new Map((resultat?.clients ?? []).map((c) => [c.tiers_id, { niveau: c.niveau, probabilite: c.probabilite_depart }]));
}

export async function listeScores(): Promise<ClientRisque[]> {
  const r = await appeler<{ clients: ClientRisque[] }>("/scores?limite=500");
  return r?.clients ?? [];
}

export type Resultat = { modele: string; auc: number; auc_ic95: number[]; ap: number; rappel_10pct: number; precision_precision_10pct: number; ca_detecte_10pct: number };

export type InfoModele = {
  version: string | null;
  date_creation: string | null;
  commit_git: string | null;
  profondeur: number;
  taux_de_base: number;
  seuils: { eleve: number; moyen: number };
  evaluation: Resultat[];
  entrainement: { observations: number; departs: number; clients: number } | null;
  test: { observations: number; departs: number; clients: number; taux_de_base: number } | null;
};

export const infoModele = () => appeler<InfoModele>("/modele");

export type LigneRegistre = { version: string; date: string; statut: string; raison: string };

export const registreModeles = () => appeler<{ production: string | null; historique: LigneRegistre[] }>("/registre");

export type Mesure = { date: string; version: string; indicateur: string; valeur: number | null; statut: "ok" | "attention" | "alerte"; detail: string };

export const surveillance = () => appeler<{ mesures: Mesure[]; instantanes_conserves: number }>("/surveillance");
