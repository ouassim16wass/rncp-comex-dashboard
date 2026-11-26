import { requete } from "./db";

export type PointCA = { periode: number; ca: number };

export async function caMensuel(): Promise<PointCA[]> {
  return requete<PointCA>(
    "select periode, sum(ca_ht)::float8 as ca from marts.mart_ca_mensuel group by 1 order by 1",
  );
}

export async function caParDomaine(debut: number, fin: number) {
  return requete<{ domaine: string; ca: number }>(
    "select domaine, sum(ca_ht)::float8 as ca from marts.mart_ca_mensuel where periode between $1 and $2 group by 1 order by 2 desc",
    [debut, fin],
  );
}

export async function caParSegment(debut: number, fin: number) {
  return requete<{ segment: string; ca: number }>(
    "select segment, sum(ca_ht)::float8 as ca from marts.mart_ca_mensuel where periode between $1 and $2 group by 1 order by 2 desc",
    [debut, fin],
  );
}

export type Sante = {
  periode: number;
  ca_facture: number | null;
  ca_comptable: number | null;
  achats: number | null;
  marge_brute: number | null;
  taux_marge: number | null;
  ecart_ca_pct: number | null;
};

export async function sante(): Promise<Sante[]> {
  return requete<Sante>(
    `select periode, ca_facture::float8, ca_comptable::float8, achats::float8, marge_brute::float8,
            taux_marge::float8, ecart_ca_pct::float8
     from marts.mart_sante_financiere order by periode`,
  );
}

export async function impayes() {
  return requete<{ date_photo: string; sens: string; tranche_retard: string; solde: number; nb_pieces: number }>(
    `select date_photo::text, sens, tranche_retard, sum(solde)::float8 as solde, sum(nb_pieces)::int as nb_pieces
     from marts.mart_impayes
     where date_photo = (select max(date_photo) from marts.mart_impayes)
     group by 1, 2, 3`,
  );
}

export async function pipeline() {
  return requete<{ date_photo: string; etape: string; nb: number; montant: number }>(
    `select date_photo::text, etape, sum(nb_opportunites)::int as nb, sum(montant_global)::float8 as montant
     from marts.mart_pipeline
     where date_photo = (select max(date_photo) from marts.mart_pipeline)
     group by 1, 2 order by 4 desc`,
  );
}

export async function winRatio() {
  const lignes = await requete<{
    date_photo: string;
    nb_gagnees: number;
    nb_perdues: number;
    nb_abandons: number;
    win_ratio_restreint: number | null;
    win_ratio_large: number | null;
  }>(
    `select date_photo::text, nb_gagnees::int, nb_perdues::int, nb_abandons::int,
            win_ratio_restreint::float8, win_ratio_large::float8
     from marts.mart_win_ratio order by date_photo desc limit 1`,
  );
  return lignes[0] ?? null;
}

export async function caClientMensuel(tiersId: number) {
  return requete<{ periode: number; ca: number }>(
    "select periode, sum(ca_ht)::float8 as ca from marts.mart_client_mensuel where tiers_id = $1 group by 1 order by 1",
    [tiersId],
  );
}

export async function echeancesClient(tiersId: number) {
  return requete<{ tranche_retard: string; solde: number; nb: number }>(
    `select tranche_retard, sum(solde)::float8 as solde, count(*)::int as nb
     from dbt_intermediate.int_echeances
     where tiers_id = $1 and sens = 'créance' and date_photo = (select max(date_photo) from dbt_intermediate.int_echeances)
     group by 1 order by 1`,
    [tiersId],
  );
}
