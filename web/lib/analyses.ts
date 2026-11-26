import { Parametres, clauseFiltre, parClient, type FiltreComex } from "./comex";
import { requete } from "./db";
import type { Fenetre } from "./periode";

export async function serieDomaineMensuelle(filtre: FiltreComex = {}) {
  const p = new Parametres();
  const lignes = await requete<{ periode: number; domaine: string; ca: number }>(
    `select periode::int as periode, domaine, sum(montant_ht)::float8 as ca
     from marts.cube_facturation where not hors_ca${clauseFiltre(p, filtre)} group by 1, 2 order by 1, 2`,
    p.valeurs,
  );
  return lignes.map((l) => ({ ...l, ca: Number(l.ca) }));
}

export async function buildRunMensuel(filtre: FiltreComex = {}) {
  const p = new Parametres();
  const lignes = await requete<{ periode: number; mode: string; ca: number }>(
    `select periode::int as periode, build_run as mode, sum(montant_ht)::float8 as ca
     from marts.cube_facturation where not hors_ca${clauseFiltre(p, filtre)} group by 1, 2 order by 1, 2`,
    p.valeurs,
  );
  return lignes.map((l) => ({ ...l, ca: Number(l.ca) }));
}

export type Retention = { nrr: number | null; grr: number | null; logos: number | null; base: number; conserves: number };

export async function retention(f: Fenetre, filtre: FiltreComex = {}): Promise<Retention> {
  const p = new Parametres();
  const [r] = await requete<Record<string, number | null>>(
    `with pc as (${parClient(p, f, filtre)})
     select
       (sum(greatest(ca, 0)) filter (where ca_n1 > 0) / nullif(sum(ca_n1) filter (where ca_n1 > 0), 0))::float8 as nrr,
       (sum(least(greatest(ca, 0), ca_n1)) filter (where ca_n1 > 0) / nullif(sum(ca_n1) filter (where ca_n1 > 0), 0))::float8 as grr,
       (count(*) filter (where ca_n1 > 0))::int as base,
       (count(*) filter (where ca_n1 > 0 and ca > 0))::int as conserves
     from pc`,
    p.valeurs,
  );
  const base = Number(r?.base ?? 0);
  const conserves = Number(r?.conserves ?? 0);
  return {
    nrr: r?.nrr === null || r?.nrr === undefined ? null : Number(r.nrr),
    grr: r?.grr === null || r?.grr === undefined ? null : Number(r.grr),
    logos: base ? conserves / base : null,
    base,
    conserves,
  };
}

export async function famillesParDomaine(f: Fenetre, filtre: FiltreComex = {}) {
  const p = new Parametres();
  const lignes = await requete<{ domaine: string; famille: string; ca: number }>(
    `select domaine, famille, sum(montant_ht)::float8 as ca
     from marts.cube_facturation
     where not hors_ca and periode between ${p.ajouter(f.debut)} and ${p.ajouter(f.fin)}${clauseFiltre(p, filtre)}
     group by 1, 2 having sum(montant_ht) > 0 order by 3 desc`,
    p.valeurs,
  );
  return lignes.map((l) => ({ ...l, ca: Number(l.ca) }));
}

export async function commerciaux(f: Fenetre, filtre: FiltreComex = {}) {
  const p = new Parametres();
  const debut = p.ajouter(f.debut);
  const fin = p.ajouter(f.fin);
  const debutN1 = p.ajouter(f.debutN1);
  const finN1 = p.ajouter(f.finN1);
  const lignes = await requete<{ commercial: string; ca: number; ca_n1: number; clients: number }>(
    `select commercial,
       coalesce(sum(montant_ht) filter (where periode between ${debut} and ${fin}), 0)::float8 as ca,
       coalesce(sum(montant_ht) filter (where periode between ${debutN1} and ${finN1}), 0)::float8 as ca_n1,
       (count(distinct tiers_id) filter (where periode between ${debut} and ${fin}))::int as clients
     from marts.cube_facturation
     where not hors_ca and periode between ${debutN1} and ${fin}${clauseFiltre(p, filtre)}
     group by 1 order by 2 desc`,
    p.valeurs,
  );
  return lignes.map((l) => ({ commercial: l.commercial, ca: Number(l.ca), caN1: Number(l.ca_n1), clients: l.clients }));
}

export async function compteResultat(f: Fenetre) {
  const lignes = await requete<{ classe: string; montant: number }>(
    `select classe, (-sum(montant_signe))::float8 as montant
     from marts.cube_marge where periode between $1 and $2 group by 1 order by 1`,
    [f.debut, f.fin],
  );
  return lignes.map((l) => ({ classe: l.classe, montant: Number(l.montant) }));
}

export async function margeMensuelle(domaines: string[] = []) {
  const valeurs: unknown[] = [];
  let where = "";
  if (domaines.length) {
    valeurs.push(domaines);
    where = "where domaine = any($1::text[])";
  }
  const lignes = await requete<{ periode: number; ca: number; achats: number }>(
    `select periode::int as periode,
       coalesce(-sum(montant_signe) filter (where classe like '1-%'), 0)::float8 as ca,
       coalesce(sum(montant_signe) filter (where classe like '2-%'), 0)::float8 as achats
     from marts.cube_marge ${where} group by 1 order by 1`,
    valeurs,
  );
  return lignes.map((l) => ({ periode: l.periode, ca: Number(l.ca), achats: Number(l.achats), marge: Number(l.ca) - Number(l.achats) }));
}

export async function caComptableMensuel() {
  const lignes = await requete<{ periode: number; ca: number }>(
    `select periode::int as periode, sum(montant_ht)::float8 as ca from marts.cube_facturation where not hors_ca group by 1 order by 1`,
  );
  return lignes.map((l) => ({ periode: l.periode, ca: Number(l.ca) }));
}

export async function pipelineCarte() {
  const photo = "(select max(date_photo) from marts.cube_pipeline)";
  const lignes = await requete<{ domaine: string; etape: string; montant: number }>(
    `select domaine, etape, coalesce(sum(montant_global), 0)::float8 as montant
     from marts.cube_pipeline where date_photo = ${photo} and etape <> all($1::text[]) group by 1, 2`,
    [["Fermée", "Abandon projet client"]],
  );
  return lignes.map((l) => ({ ...l, montant: Number(l.montant) }));
}

export async function clientsActifsMensuels(filtre: FiltreComex = {}) {
  const p = new Parametres();
  const lignes = await requete<{ periode: number; clients: number }>(
    `select periode::int as periode, (count(distinct tiers_id) filter (where montant_ht > 0))::int as clients
     from marts.cube_facturation where not hors_ca${clauseFiltre(p, filtre)} group by 1 order by 1`,
    p.valeurs,
  );
  return lignes;
}

export type Operations = {
  debut: string | null;
  fin: string | null;
  total: number;
  incidents: number;
  demandes: number;
  slaIncidents: number | null;
  slaDemandes: number | null;
  slaGlobal: number | null;
  resolutionMoyenne: number | null;
  resolutionMediane: number | null;
  backlog: number;
  quotidien: { jour: string; type: string; nb: number }[];
  hebdo: { semaine: string; total: number; depasses: number }[];
  priorites: { niveau: string; origine: string; nb: number }[];
  impacts: { impact: string; nb: number }[];
  etats: { etat: string; nb: number }[];
  delais: { tranche: string; nb: number }[];
  clientsLies: number;
};

export async function operations(): Promise<Operations> {
  const [[g], quotidien, hebdo, priorites, impacts, etats, delais] = await Promise.all([
    requete<Record<string, number | string | null>>(
      `select to_char(min(date_debut), 'YYYY-MM-DD') as debut, to_char(max(date_debut), 'YYYY-MM-DD') as fin,
        count(*)::int as total,
        (count(*) filter (where type = 'incident'))::int as incidents,
        (count(*) filter (where type = 'demande'))::int as demandes,
        (count(*) filter (where type = 'incident' and sla_ttr_depasse))::float8 / nullif(count(*) filter (where type = 'incident'), 0) as sla_inc,
        (count(*) filter (where type = 'demande' and sla_ttr_depasse))::float8 / nullif(count(*) filter (where type = 'demande'), 0) as sla_dem,
        (count(*) filter (where sla_ttr_depasse))::float8 / nullif(count(*), 0) as sla_glob,
        avg(jours_resolution)::float8 as moy,
        (percentile_cont(0.5) within group (order by jours_resolution))::float8 as med,
        (count(*) filter (where etat not in ('Fermée', 'Résolu')))::int as backlog,
        (count(*) filter (where code_sage is not null))::int as lies
       from marts.cube_tickets`,
    ),
    requete<{ jour: string; type: string; nb: number }>(
      `select to_char(date_debut, 'YYYY-MM-DD') as jour, coalesce(type, 'Non renseigné') as type, count(*)::int as nb
       from marts.cube_tickets group by 1, 2 order by 1, 2`,
    ),
    requete<{ semaine: string; total: number; depasses: number }>(
      `select to_char(semaine, 'YYYY-MM-DD') as semaine, count(*)::int as total, (count(*) filter (where sla_ttr_depasse))::int as depasses
       from marts.cube_tickets group by 1 order by 1`,
    ),
    requete<{ niveau: string; origine: string; nb: number }>(
      `select niveau_priorite as niveau, origine, count(*)::int as nb from marts.cube_tickets group by 1, 2 order by 3 desc`,
    ),
    requete<{ impact: string; nb: number }>(`select impact, count(*)::int as nb from marts.cube_tickets group by 1 order by 2 desc`),
    requete<{ etat: string; nb: number }>(`select etat, count(*)::int as nb from marts.cube_tickets group by 1 order by 2 desc`),
    requete<{ tranche: string; nb: number }>(
      `select case when jours_resolution = 0 then 'Le jour même'
                   when jours_resolution <= 2 then '1 à 2 jours'
                   when jours_resolution <= 7 then '3 à 7 jours'
                   when jours_resolution <= 30 then '8 à 30 jours'
                   else 'Plus de 30 jours' end as tranche, count(*)::int as nb
       from marts.cube_tickets where jours_resolution is not null group by 1`,
    ),
  ]);
  const n = (k: string) => (g?.[k] === null || g?.[k] === undefined ? null : Number(g[k]));
  return {
    debut: (g?.debut as string | null) ?? null,
    fin: (g?.fin as string | null) ?? null,
    total: Number(g?.total ?? 0),
    incidents: Number(g?.incidents ?? 0),
    demandes: Number(g?.demandes ?? 0),
    slaIncidents: n("sla_inc"),
    slaDemandes: n("sla_dem"),
    slaGlobal: n("sla_glob"),
    resolutionMoyenne: n("moy"),
    resolutionMediane: n("med"),
    backlog: Number(g?.backlog ?? 0),
    quotidien,
    hebdo,
    priorites,
    impacts,
    etats,
    delais,
    clientsLies: Number(g?.lies ?? 0),
  };
}

export async function buildRunParDomaine(f: Fenetre, filtre: FiltreComex = {}) {
  const p = new Parametres();
  const lignes = await requete<{ domaine: string; mode: string; ca: number }>(
    `select domaine, build_run as mode, sum(montant_ht)::float8 as ca
     from marts.cube_facturation
     where not hors_ca and periode between ${p.ajouter(f.debut)} and ${p.ajouter(f.fin)}${clauseFiltre(p, filtre)}
     group by 1, 2`,
    p.valeurs,
  );
  return lignes.map((l) => ({ ...l, ca: Number(l.ca) }));
}

export async function serieParDimension(dimension: "segment" | "domaine", filtre: FiltreComex = {}) {
  const p = new Parametres();
  const colonne = dimension === "segment" ? "segment" : "domaine";
  const lignes = await requete<{ periode: number; membre: string; ca: number }>(
    `select periode::int as periode, ${colonne} as membre, sum(montant_ht)::float8 as ca
     from marts.cube_facturation where not hors_ca${clauseFiltre(p, filtre)} group by 1, 2 order by 1, 2`,
    p.valeurs,
  );
  return lignes.map((l) => ({ ...l, ca: Number(l.ca) }));
}

export async function echeancesTrancheSegment() {
  const photo = "(select max(date_photo) from marts.cube_echeances)";
  const lignes = await requete<{ tranche: string; segment: string; solde: number }>(
    `select tranche_retard as tranche, segment, sum(solde)::float8 as solde
     from marts.cube_echeances where sens = 'créance' and date_photo = ${photo} group by 1, 2`,
  );
  return lignes.map((l) => ({ ...l, solde: Number(l.solde) }));
}

export async function dettesParTranche() {
  const photo = "(select max(date_photo) from marts.cube_echeances)";
  const lignes = await requete<{ tranche: string; solde: number }>(
    `select tranche_retard as tranche, (-sum(solde))::float8 as solde
     from marts.cube_echeances where sens = 'dette' and date_photo = ${photo} group by 1`,
  );
  return lignes.map((l) => ({ ...l, solde: Number(l.solde) }));
}
