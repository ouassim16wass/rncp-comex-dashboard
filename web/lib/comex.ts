import { FACTURATION } from "./cubes";
import { requete } from "./db";
import { moinsMois, type Fenetre } from "./periode";

export type FiltreComex = { segments?: string[]; domaines?: string[] };

export class Parametres {
  valeurs: unknown[] = [];
  ajouter(v: unknown): string {
    this.valeurs.push(v);
    return `$${this.valeurs.length}`;
  }
}

export function clauseFiltre(p: Parametres, filtre: FiltreComex): string {
  let sql = "";
  if (filtre.segments?.length) sql += ` and segment = any(${p.ajouter(filtre.segments)}::text[])`;
  if (filtre.domaines?.length) sql += ` and domaine = any(${p.ajouter(filtre.domaines)}::text[])`;
  return sql;
}

export function parClient(p: Parametres, f: Fenetre, filtre: FiltreComex): string {
  const debut = p.ajouter(f.debut);
  const fin = p.ajouter(f.fin);
  const debutN1 = p.ajouter(f.debutN1);
  const finN1 = p.ajouter(f.finN1);
  return `select tiers_id, max(client) as client, max(segment) as segment,
    coalesce(sum(montant_ht) filter (where periode between ${debut} and ${fin}), 0)::float8 as ca,
    coalesce(sum(montant_ht) filter (where periode between ${debutN1} and ${finN1}), 0)::float8 as ca_n1
  from marts.cube_facturation
  where not hors_ca and periode between ${debutN1} and ${fin}${clauseFiltre(p, filtre)}
  group by tiers_id`;
}

export async function moisDisponibles(): Promise<number[]> {
  const lignes = await requete<{ periode: number }>("select distinct periode::int as periode from marts.cube_facturation order by 1");
  return lignes.map((l) => l.periode);
}

export type Kpis = {
  ca: number;
  caN1: number;
  actifs: number;
  actifsN1: number;
  nouveaux: { nb: number; ca: number };
  perdus: { nb: number; ca: number };
  enHausse: { nb: number; ca: number; caN1: number };
  enBaisse: { nb: number; ca: number; caN1: number };
  stables: { nb: number };
  partGroupe: number | null;
};

export async function kpis(f: Fenetre, filtre: FiltreComex = {}): Promise<Kpis> {
  const p = new Parametres();
  const sql = `with pc as (${parClient(p, f, filtre)})
select
  coalesce(sum(ca), 0)::float8 as ca,
  coalesce(sum(ca_n1), 0)::float8 as ca_n1,
  (count(*) filter (where ca > 0))::int as actifs,
  (count(*) filter (where ca_n1 > 0))::int as actifs_n1,
  (count(*) filter (where ca > 0 and ca_n1 <= 0))::int as nouveaux_nb,
  coalesce(sum(ca) filter (where ca > 0 and ca_n1 <= 0), 0)::float8 as nouveaux_ca,
  (count(*) filter (where ca <= 0 and ca_n1 > 0))::int as perdus_nb,
  coalesce(sum(ca_n1) filter (where ca <= 0 and ca_n1 > 0), 0)::float8 as perdus_ca,
  (count(*) filter (where ca > 0 and ca_n1 > 0 and ca >= ca_n1 * 1.2))::int as hausse_nb,
  coalesce(sum(ca) filter (where ca > 0 and ca_n1 > 0 and ca >= ca_n1 * 1.2), 0)::float8 as hausse_ca,
  coalesce(sum(ca_n1) filter (where ca > 0 and ca_n1 > 0 and ca >= ca_n1 * 1.2), 0)::float8 as hausse_ca_n1,
  (count(*) filter (where ca > 0 and ca_n1 > 0 and ca <= ca_n1 * 0.8))::int as baisse_nb,
  coalesce(sum(ca) filter (where ca > 0 and ca_n1 > 0 and ca <= ca_n1 * 0.8), 0)::float8 as baisse_ca,
  coalesce(sum(ca_n1) filter (where ca > 0 and ca_n1 > 0 and ca <= ca_n1 * 0.8), 0)::float8 as baisse_ca_n1,
  (count(*) filter (where ca > 0 and ca_n1 > 0 and ca > ca_n1 * 0.8 and ca < ca_n1 * 1.2))::int as stables_nb,
  (sum(ca) filter (where segment = 'Groupe') / nullif(sum(ca) filter (where ca > 0), 0))::float8 as part_groupe
from pc`;
  const [r] = await requete<Record<string, number | null>>(sql, p.valeurs);
  const n = (k: string) => Number(r?.[k] ?? 0);
  return {
    ca: n("ca"),
    caN1: n("ca_n1"),
    actifs: n("actifs"),
    actifsN1: n("actifs_n1"),
    nouveaux: { nb: n("nouveaux_nb"), ca: n("nouveaux_ca") },
    perdus: { nb: n("perdus_nb"), ca: n("perdus_ca") },
    enHausse: { nb: n("hausse_nb"), ca: n("hausse_ca"), caN1: n("hausse_ca_n1") },
    enBaisse: { nb: n("baisse_nb"), ca: n("baisse_ca"), caN1: n("baisse_ca_n1") },
    stables: { nb: n("stables_nb") },
    partGroupe: r?.part_groupe === null || r?.part_groupe === undefined ? null : Number(r.part_groupe),
  };
}

export type PointMensuel = { periode: number; ca: number };

export async function serieMensuelle(filtre: FiltreComex = {}): Promise<PointMensuel[]> {
  const p = new Parametres();
  return requete<PointMensuel>(
    `select periode::int as periode, sum(montant_ht)::float8 as ca from marts.cube_facturation where not hors_ca${clauseFiltre(p, filtre)} group by 1 order by 1`,
    p.valeurs,
  );
}

export type LignePont = { membre: string; ca: number; caN1: number };

export async function pont(f: Fenetre, dimension: string, filtre: FiltreComex = {}): Promise<LignePont[]> {
  const d = FACTURATION.dimensions.find((x) => x.cle === dimension);
  if (!d) throw new Error(`Axe inconnu : ${dimension}`);
  const p = new Parametres();
  const debut = p.ajouter(f.debut);
  const fin = p.ajouter(f.fin);
  const debutN1 = p.ajouter(f.debutN1);
  const finN1 = p.ajouter(f.finN1);
  return requete<LignePont>(
    `select ${d.sql} as membre,
      coalesce(sum(montant_ht) filter (where periode between ${debut} and ${fin}), 0)::float8 as ca,
      coalesce(sum(montant_ht) filter (where periode between ${debutN1} and ${finN1}), 0)::float8 as ca_n1
     from marts.cube_facturation
     where not hors_ca and periode between ${debutN1} and ${fin}${clauseFiltre(p, filtre)}
     group by 1`,
    p.valeurs,
  ).then((l) => l.map((x) => ({ membre: x.membre, ca: Number(x.ca), caN1: Number((x as unknown as { ca_n1: number }).ca_n1) })));
}

export type ClientConcentration = { tiersId: number; client: string; segment: string; ca: number; part: number; cumul: number };

export type Concentration = { top: ClientConcentration[]; top1: number; top5: number; top10: number; top20: number; nbClients: number };

export async function concentration(f: Fenetre, filtre: FiltreComex = {}, nb = 20): Promise<Concentration> {
  const p = new Parametres();
  const lignes = await requete<{ tiers_id: number; client: string; segment: string; ca: number }>(
    `with pc as (${parClient(p, f, filtre)}) select tiers_id, client, segment, ca from pc where ca > 0 order by ca desc`,
    p.valeurs,
  );
  const total = lignes.reduce((t, l) => t + Number(l.ca), 0) || 1;
  let cumul = 0;
  const top = lignes.slice(0, nb).map((l) => {
    cumul += Number(l.ca);
    return { tiersId: l.tiers_id, client: l.client, segment: l.segment, ca: Number(l.ca), part: Number(l.ca) / total, cumul: cumul / total };
  });
  const part = (n: number) => lignes.slice(0, n).reduce((t, l) => t + Number(l.ca), 0) / total;
  return { top, top1: part(1), top5: part(5), top10: part(10), top20: part(20), nbClients: lignes.length };
}

export type Statut = "nouveau" | "perdu" | "hausse" | "baisse" | "stable";

export type LigneClient = {
  tiersId: number;
  client: string;
  segment: string;
  ca: number;
  caN1: number;
  variation: number | null;
  part: number;
  statut: Statut;
  dernier: number | null;
  moisSansFacture: number | null;
  echu: number;
  echu30: number;
};

export function classer(ca: number, caN1: number): Statut {
  if (ca > 0 && caN1 <= 0) return "nouveau";
  if (ca <= 0 && caN1 > 0) return "perdu";
  if (ca > 0 && caN1 > 0 && ca >= caN1 * 1.2) return "hausse";
  if (ca > 0 && caN1 > 0 && ca <= caN1 * 0.8) return "baisse";
  return "stable";
}

export function ecartMois(a: number, b: number): number {
  return Math.floor(a / 100) * 12 + (a % 100) - (Math.floor(b / 100) * 12 + (b % 100));
}

export async function portefeuille(f: Fenetre, filtre: FiltreComex = {}): Promise<LigneClient[]> {
  const p = new Parametres();
  const sql = `with pc as (${parClient(p, f, filtre)}),
dernier as (
  select tiers_id, max(periode) filter (where montant_ht > 0)::int as dernier
  from marts.cube_facturation where not hors_ca and periode <= ${p.ajouter(f.fin)} group by 1
),
creances as (
  select tiers_id,
         coalesce(sum(solde) filter (where jours_retard >= 0), 0)::float8 as echu,
         coalesce(sum(solde) filter (where jours_retard > 30), 0)::float8 as echu30
  from marts.cube_echeances
  where sens = 'créance' and date_photo = (select max(date_photo) from marts.cube_echeances)
  group by 1
)
select pc.tiers_id, pc.client, pc.segment, pc.ca, pc.ca_n1, d.dernier, coalesce(c.echu, 0) as echu, coalesce(c.echu30, 0) as echu30
from pc left join dernier d using (tiers_id) left join creances c using (tiers_id)
where pc.ca <> 0 or pc.ca_n1 <> 0`;
  const lignes = await requete<{
    tiers_id: number;
    client: string;
    segment: string;
    ca: number;
    ca_n1: number;
    dernier: number | null;
    echu: number;
    echu30: number;
  }>(sql, p.valeurs);
  const total = lignes.reduce((t, l) => t + Math.max(Number(l.ca), 0), 0) || 1;
  return lignes.map((l) => {
    const ca = Number(l.ca);
    const caN1 = Number(l.ca_n1);
    return {
      tiersId: l.tiers_id,
      client: l.client,
      segment: l.segment,
      ca,
      caN1,
      variation: caN1 > 0 ? ca / caN1 - 1 : null,
      part: Math.max(ca, 0) / total,
      statut: classer(ca, caN1),
      dernier: l.dernier,
      moisSansFacture: l.dernier ? Math.max(ecartMois(f.fin, l.dernier), 0) : null,
      echu: Number(l.echu),
      echu30: Number(l.echu30),
    };
  });
}

export type MargeKpi = { ca: number | null; marge: number | null; caN1: number | null; margeN1: number | null; dernierMois: number | null; premierMois: number | null };

export async function margeKpi(f: Fenetre): Promise<MargeKpi> {
  const [r] = await requete<Record<string, number | null>>(
    `select
      (-sum(montant_signe) filter (where classe like '1-%' and periode between $1 and $2))::float8 as ca,
      (-sum(montant_signe) filter (where classe like '1-%' and periode between $1 and $2)
        - sum(montant_signe) filter (where classe like '2-%' and periode between $1 and $2))::float8 as marge,
      (-sum(montant_signe) filter (where classe like '1-%' and periode between $3 and $4))::float8 as ca_n1,
      (-sum(montant_signe) filter (where classe like '1-%' and periode between $3 and $4)
        - sum(montant_signe) filter (where classe like '2-%' and periode between $3 and $4))::float8 as marge_n1,
      max(periode)::int as dernier,
      min(periode)::int as premier
     from marts.cube_marge`,
    [f.debut, f.fin, f.debutN1, f.finN1],
  );
  const v = (k: string) => (r?.[k] === null || r?.[k] === undefined ? null : Number(r[k]));
  return { ca: v("ca"), marge: v("marge"), caN1: v("ca_n1"), margeN1: v("marge_n1"), dernierMois: v("dernier"), premierMois: v("premier") };
}

export async function ecartComptable(): Promise<number | null> {
  const [r] = await requete<{ ecart: number | null }>(
    `select ecart_ca_pct::float8 as ecart from marts.mart_sante_financiere where ca_comptable is not null and ca_facture is not null order by periode desc limit 1`,
  );
  return r?.ecart === null || r?.ecart === undefined ? null : Number(r.ecart);
}

export type Tresorerie = {
  photo: string | null;
  creances: number;
  echu: number;
  echu30: number;
  dettes: number;
  dettesEchues: number;
  nbPieces: number;
  parTranche: { tranche: string; solde: number; nb: number }[];
  parSegment: { segment: string; total: number; echu: number; echu30: number }[];
  debiteurs: { tiersId: number; client: string; segment: string; total: number; echu: number; echu30: number; nb: number; retardMax: number }[];
};

export async function tresorerie(): Promise<Tresorerie> {
  const photo = "(select max(date_photo) from marts.cube_echeances)";
  const [[g], parTranche, parSegment, debiteurs] = await Promise.all([
    requete<Record<string, number | string | null>>(
      `select to_char(${photo}, 'YYYY-MM-DD') as photo,
        coalesce(sum(solde) filter (where sens = 'créance'), 0)::float8 as creances,
        coalesce(sum(solde) filter (where sens = 'créance' and jours_retard >= 0), 0)::float8 as echu,
        coalesce(sum(solde) filter (where sens = 'créance' and jours_retard > 30), 0)::float8 as echu30,
        coalesce(-sum(solde) filter (where sens = 'dette'), 0)::float8 as dettes,
        coalesce(-sum(solde) filter (where sens = 'dette' and jours_retard >= 0), 0)::float8 as dettes_echues,
        count(*)::int as nb
       from marts.cube_echeances where date_photo = ${photo}`,
    ),
    requete<{ tranche: string; solde: number; nb: number }>(
      `select tranche_retard as tranche, sum(solde)::float8 as solde, count(*)::int as nb
       from marts.cube_echeances where sens = 'créance' and date_photo = ${photo} group by 1`,
    ),
    requete<{ segment: string; total: number; echu: number; echu30: number }>(
      `select segment, sum(solde)::float8 as total,
        coalesce(sum(solde) filter (where jours_retard >= 0), 0)::float8 as echu,
        coalesce(sum(solde) filter (where jours_retard > 30), 0)::float8 as echu30
       from marts.cube_echeances where sens = 'créance' and date_photo = ${photo} group by 1 order by 2 desc`,
    ),
    requete<{ tiers_id: number; client: string; segment: string; total: number; echu: number; echu30: number; nb: number; retard_max: number }>(
      `select tiers_id, max(client) as client, max(segment) as segment, sum(solde)::float8 as total,
        coalesce(sum(solde) filter (where jours_retard >= 0), 0)::float8 as echu,
        coalesce(sum(solde) filter (where jours_retard > 30), 0)::float8 as echu30,
        count(*)::int as nb, coalesce(max(jours_retard), 0)::int as retard_max
       from marts.cube_echeances where sens = 'créance' and date_photo = ${photo}
       group by tiers_id order by 5 desc limit 15`,
    ),
  ]);
  const n = (k: string) => Number(g?.[k] ?? 0);
  return {
    photo: (g?.photo as string | null) ?? null,
    creances: n("creances"),
    echu: n("echu"),
    echu30: n("echu30"),
    dettes: n("dettes"),
    dettesEchues: n("dettes_echues"),
    nbPieces: n("nb"),
    parTranche,
    parSegment,
    debiteurs: debiteurs.map((d) => ({
      tiersId: d.tiers_id,
      client: d.client,
      segment: d.segment,
      total: Number(d.total),
      echu: Number(d.echu),
      echu30: Number(d.echu30),
      nb: d.nb,
      retardMax: d.retard_max,
    })),
  };
}

export type Pipeline = {
  photo: string | null;
  ouvert: { montant: number; nb: number };
  parEtape: { etape: string; montant: number; nb: number }[];
  parDomaine: { domaine: string; montant: number; nb: number }[];
  gain: { cle: string; membre: string; gagnees: number; perdues: number; abandons: number; ratio: number | null; large: number | null }[];
  gainTotal: { gagnees: number; perdues: number; abandons: number; ratio: number | null; large: number | null };
  top: { client: string; domaine: string; etape: string; typeAffaire: string; montant: number }[];
};

const ETAPES_FERMEES = ["Fermée", "Abandon projet client"];

export async function pipeline(dimension: "domaine" | "commercial" | "type_affaire" = "domaine"): Promise<Pipeline> {
  const colonne = dimension === "commercial" ? "commercial" : dimension === "type_affaire" ? "type_affaire" : "domaine";
  const photo = "(select max(date_photo) from marts.cube_pipeline)";
  const ouvert = `etape <> all($1::text[])`;
  const [[photoLigne], parEtape, parDomaine, gain, top] = await Promise.all([
    requete<{ photo: string | null }>(`select to_char(${photo}, 'YYYY-MM-DD') as photo`),
    requete<{ etape: string; montant: number; nb: number }>(
      `select etape, coalesce(sum(montant_global), 0)::float8 as montant, count(*)::int as nb
       from marts.cube_pipeline where date_photo = ${photo} group by 1 order by 2 desc`,
    ),
    requete<{ domaine: string; montant: number; nb: number }>(
      `select domaine, coalesce(sum(montant_global), 0)::float8 as montant, count(*)::int as nb
       from marts.cube_pipeline where date_photo = ${photo} and ${ouvert} group by 1 order by 2 desc`,
      [ETAPES_FERMEES],
    ),
    requete<{ membre: string; gagnees: number; perdues: number; abandons: number }>(
      `select ${colonne} as membre,
        (count(*) filter (where motif_cloture like 'Gagnée%'))::int as gagnees,
        (count(*) filter (where motif_cloture = 'Perdue'))::int as perdues,
        (count(*) filter (where motif_cloture = 'Abandonnée' or motif_cloture like 'No Go%'))::int as abandons
       from marts.cube_pipeline where date_photo = ${photo} group by 1
       having count(*) filter (where motif_cloture like 'Gagnée%' or motif_cloture = 'Perdue' or motif_cloture = 'Abandonnée' or motif_cloture like 'No Go%') > 0
       order by 2 desc`,
    ),
    requete<{ client: string; domaine: string; etape: string; type_affaire: string; montant: number }>(
      `select client, domaine, etape, type_affaire, montant_global::float8 as montant
       from marts.cube_pipeline where date_photo = ${photo} and ${ouvert} and montant_global is not null
       order by montant_global desc limit 15`,
      [ETAPES_FERMEES],
    ),
  ]);
  const ratio = (g: number, pe: number) => (g + pe > 0 ? g / (g + pe) : null);
  const large = (g: number, pe: number, a: number) => (g + pe + a > 0 ? g / (g + pe + a) : null);
  const ouverts = parEtape.filter((e) => !ETAPES_FERMEES.includes(e.etape));
  const total = gain.reduce((t, x) => ({ g: t.g + x.gagnees, pe: t.pe + x.perdues, a: t.a + x.abandons }), { g: 0, pe: 0, a: 0 });
  return {
    photo: photoLigne?.photo ?? null,
    ouvert: { montant: ouverts.reduce((t, e) => t + Number(e.montant), 0), nb: ouverts.reduce((t, e) => t + e.nb, 0) },
    parEtape: parEtape.map((e) => ({ ...e, montant: Number(e.montant) })),
    parDomaine: parDomaine.map((e) => ({ ...e, montant: Number(e.montant) })),
    gain: gain.map((x) => ({
      cle: dimension,
      membre: x.membre,
      gagnees: x.gagnees,
      perdues: x.perdues,
      abandons: x.abandons,
      ratio: ratio(x.gagnees, x.perdues),
      large: large(x.gagnees, x.perdues, x.abandons),
    })),
    gainTotal: { gagnees: total.g, perdues: total.pe, abandons: total.a, ratio: ratio(total.g, total.pe), large: large(total.g, total.pe, total.a) },
    top: top.map((t) => ({ client: t.client, domaine: t.domaine, etape: t.etape, typeAffaire: t.type_affaire, montant: Number(t.montant) })),
  };
}

export type ExecutionSource = {
  etape: string;
  source: string;
  debut: string;
  statut: string;
  lues: number;
  chargees: number;
  rejetees: number;
  tauxRejet: number;
  dureeS: number;
  message: string | null;
  sommeBrute: number | null;
  sommeStaging: number | null;
  sommeEntrepot: number | null;
  mesure: string | null;
};

export async function executions(): Promise<ExecutionSource[]> {
  const lignes = await requete<Record<string, string | number | null>>(
    `select distinct on (etape) etape, source, to_char(debut, 'YYYY-MM-DD HH24:MI') as debut, statut,
        coalesce(lignes_lues, 0)::int as lues, coalesce(lignes_chargees, 0)::int as chargees,
        coalesce(lignes_rejetees, 0)::int as rejetees, coalesce(taux_rejet, 0)::float8 as taux, coalesce(duree_s, 0)::float8 as duree, message,
        somme_brute::float8 as somme_brute, somme_staging::float8 as somme_staging, somme_entrepot::float8 as somme_entrepot, mesure_controlee as mesure
     from supervision.execution order by etape, execution_id desc`,
  );
  return lignes.map((l) => ({
    etape: String(l.etape),
    source: String(l.source),
    debut: String(l.debut),
    statut: String(l.statut),
    lues: Number(l.lues),
    chargees: Number(l.chargees),
    rejetees: Number(l.rejetees),
    tauxRejet: Number(l.taux),
    dureeS: Number(l.duree),
    message: (l.message as string | null) ?? null,
    sommeBrute: l.somme_brute === null || l.somme_brute === undefined ? null : Number(l.somme_brute),
    sommeStaging: l.somme_staging === null || l.somme_staging === undefined ? null : Number(l.somme_staging),
    sommeEntrepot: l.somme_entrepot === null || l.somme_entrepot === undefined ? null : Number(l.somme_entrepot),
    mesure: (l.mesure as string | null) ?? null,
  }));
}

export async function couverture(): Promise<{ jeu: string; debut: string; fin: string; lignes: number }[]> {
  return requete<{ jeu: string; debut: string; fin: string; lignes: number }>(
    `select 'CA facturé (mois Sage)' as jeu, min(periode)::text as debut, max(periode)::text as fin, count(*)::int as lignes from marts.cube_facturation
     union all select 'Écritures de marge (mois comptable)', min(periode)::text, max(periode)::text, count(*)::int from marts.cube_marge
     union all select 'Échéances (dates de photo)', to_char(min(date_photo), 'YYYY-MM-DD'), to_char(max(date_photo), 'YYYY-MM-DD'), count(*)::int from marts.cube_echeances
     union all select 'Opportunités (dates de photo)', to_char(min(date_photo), 'YYYY-MM-DD'), to_char(max(date_photo), 'YYYY-MM-DD'), count(*)::int from marts.cube_pipeline`,
  );
}

export type Client360 = {
  tiersId: number;
  client: string;
  segment: string;
  code: string;
  mensuel: { periode: number; domaine: string; ca: number }[];
  familles: { famille: string; ca: number }[];
  echeances: { tranche: string; solde: number; nb: number }[];
  opportunites: { domaine: string; etape: string; typeAffaire: string; motif: string; montant: number }[];
  premier: number | null;
  dernier: number | null;
};

export async function client360(tiersId: number, f: Fenetre): Promise<Client360 | null> {
  const [info] = await requete<{ client: string; segment: string; code: string }>(
    `select max(client) as client, max(segment) as segment, max(code_sage) as code from marts.cube_facturation where tiers_id = $1`,
    [tiersId],
  );
  if (!info?.client) return null;
  const [mensuel, familles, echeances, opportunites, [bornes]] = await Promise.all([
    requete<{ periode: number; domaine: string; ca: number }>(
      `select periode::int as periode, domaine, sum(montant_ht)::float8 as ca from marts.cube_facturation
       where tiers_id = $1 and not hors_ca and periode >= $2 group by 1, 2 order by 1`,
      [tiersId, moinsMois(f.fin, 23)],
    ),
    requete<{ famille: string; ca: number }>(
      `select famille, sum(montant_ht)::float8 as ca from marts.cube_facturation
       where tiers_id = $1 and not hors_ca and periode between $2 and $3 group by 1 order by 2 desc limit 8`,
      [tiersId, f.debut, f.fin],
    ),
    requete<{ tranche: string; solde: number; nb: number }>(
      `select tranche_retard as tranche, sum(solde)::float8 as solde, count(*)::int as nb from marts.cube_echeances
       where tiers_id = $1 and sens = 'créance' and date_photo = (select max(date_photo) from marts.cube_echeances) group by 1`,
      [tiersId],
    ),
    requete<{ domaine: string; etape: string; type_affaire: string; motif: string; montant: number }>(
      `select domaine, etape, type_affaire, motif_cloture as motif, coalesce(montant_global, 0)::float8 as montant from marts.cube_pipeline
       where client = $1 and date_photo = (select max(date_photo) from marts.cube_pipeline) order by 5 desc limit 20`,
      [info.client],
    ),
    requete<{ premier: number | null; dernier: number | null }>(
      `select min(periode) filter (where montant_ht > 0)::int as premier, max(periode) filter (where montant_ht > 0)::int as dernier
       from marts.cube_facturation where tiers_id = $1 and not hors_ca`,
      [tiersId],
    ),
  ]);
  return {
    tiersId,
    client: info.client,
    segment: info.segment,
    code: info.code,
    mensuel: mensuel.map((m) => ({ ...m, ca: Number(m.ca) })),
    familles: familles.map((m) => ({ ...m, ca: Number(m.ca) })),
    echeances: echeances.map((e) => ({ ...e, solde: Number(e.solde) })),
    opportunites: opportunites.map((o) => ({ domaine: o.domaine, etape: o.etape, typeAffaire: o.type_affaire, motif: o.motif, montant: Number(o.montant) })),
    premier: bornes?.premier ?? null,
    dernier: bornes?.dernier ?? null,
  };
}

export async function margeParDomaine(f: Fenetre): Promise<{ domaine: string; ca: number; achats: number; marge: number }[]> {
  const lignes = await requete<{ domaine: string; ca: number; achats: number }>(
    `select domaine,
      coalesce(-sum(montant_signe) filter (where classe like '1-%'), 0)::float8 as ca,
      coalesce(sum(montant_signe) filter (where classe like '2-%'), 0)::float8 as achats
     from marts.cube_marge where periode between $1 and $2 group by 1 order by 2 desc`,
    [f.debut, f.fin],
  );
  return lignes.map((l) => ({ domaine: l.domaine, ca: Number(l.ca), achats: Number(l.achats), marge: Number(l.ca) - Number(l.achats) }));
}

export async function caDouzeMois(fin: number): Promise<number> {
  const [r] = await requete<{ ca: number }>(
    `select coalesce(sum(montant_ht), 0)::float8 as ca from marts.cube_facturation where not hors_ca and periode between $1 and $2`,
    [moinsMois(fin, 11), fin],
  );
  return Number(r?.ca ?? 0);
}

export async function controlesCubes() {
  const photoEcheances = "(select max(date_photo) from marts.cube_echeances)";
  const photoPipeline = "(select max(date_photo) from marts.cube_pipeline)";
  const [[a], [b], [c], [d]] = await Promise.all([
    requete<{ entrepot: number; cube: number }>(
      `select (select sum(montant_ht) from dwh.fait_facturation)::float8 as entrepot, (select sum(montant_ht) from marts.cube_facturation)::float8 as cube`,
    ),
    requete<{ entrepot: number; cube: number }>(
      `select (select sum(montant_signe) from dwh.fait_marge)::float8 as entrepot, (select sum(montant_signe) from marts.cube_marge)::float8 as cube`,
    ),
    requete<{ entrepot: number; cube: number }>(
      `select (select sum(f.solde) from dwh.fait_echeance f join dwh.dim_date d on d.date_id = f.date_photo_id where d.date = ${photoEcheances})::float8 as entrepot,
              (select sum(solde) from marts.cube_echeances where date_photo = ${photoEcheances})::float8 as cube`,
    ),
    requete<{ entrepot: number; cube: number }>(
      `select (select sum(f.montant_global) from dwh.fait_opportunite f join dwh.dim_date d on d.date_id = f.date_photo_id where d.date = ${photoPipeline})::float8 as entrepot,
              (select sum(montant_global) from marts.cube_pipeline where date_photo = ${photoPipeline})::float8 as cube`,
    ),
  ]);
  const n = (x: { entrepot: number; cube: number } | undefined) => ({ entrepot: Number(x?.entrepot ?? 0), cube: Number(x?.cube ?? 0) });
  return { pyspark_ca: n(a), pyspark_marge: n(b), echeances: n(c), pyspark_opportunites: n(d) };
}
