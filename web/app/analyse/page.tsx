import Link from "next/link";
import { Explorateur } from "@/components/Explorateur";
import { Entete } from "@/components/ui/Entete";
import { CUBES } from "@/lib/cubes";
import type { ParamsUrl } from "@/lib/filtres";

export const dynamic = "force-dynamic";

const TEXTES: Record<string, string> = {
  facturation: "Chiffre d'affaires facturé par domaine, service, segment, famille, article, commercial et client.",
  marge: "Produits, achats et charges des écritures comptables par domaine, classe de comptes et famille de charge.",
  echeances: "Créances et dettes ouvertes par ancienneté de retard, segment et tiers.",
  pipeline: "Opportunités Salesforce par étape, domaine, type d'affaire, commercial et compte.",
};

export default async function Page({ searchParams }: { searchParams: Promise<ParamsUrl> }) {
  const params = await searchParams;
  const brut = Array.isArray(params.cube) ? params.cube[0] : params.cube;
  const cle = brut && CUBES[brut] ? brut : "facturation";
  const parametres = Object.fromEntries(Object.entries(params).filter(([c]) => c !== "cube"));
  return (
    <>
      <Entete titre="Analyse libre" question="Croisez deux axes, changez de granularité, filtrez, descendez dans le détail et exportez." filtres={false} />
      <div className="bascule" style={{ margin: "14px 0" }} role="group" aria-label="Jeu de données">
        {Object.values(CUBES).map((c) => (
          <Link key={c.cle} href={`/analyse?cube=${c.cle}`} aria-pressed={cle === c.cle}>
            {c.libelle}
          </Link>
        ))}
      </div>
      <Explorateur cleCube={cle} params={parametres} base={`/analyse?cube=${cle}`} titre={CUBES[cle].libelle} titreNiveau="h2" introduction={TEXTES[cle]} />
    </>
  );
}
