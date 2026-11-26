import { Pool } from "pg";

export const modeDemo = process.env.MODE_DEMO !== "0";
const base = modeDemo ? "entrepot_demo" : "entrepot";

const globale = globalThis as unknown as { _pool?: Pool };

const pool =
  globale._pool ??
  new Pool({
    host: process.env.PG_HOTE ?? "localhost",
    port: Number(process.env.PG_PORT ?? 5442),
    user: process.env.PG_UTILISATEUR ?? "entrepot",
    password: process.env.PG_MOT_DE_PASSE ?? "",
    database: base,
    max: 5,
  });

globale._pool = pool;

export async function requete<T>(sql: string, parametres: unknown[] = []): Promise<T[]> {
  const resultat = await pool.query(sql, parametres);
  return resultat.rows as T[];
}
