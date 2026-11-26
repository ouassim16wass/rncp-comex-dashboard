import Link from "next/link";
import type { Alerte } from "@/lib/alertes";

const LIBELLES = { alerte: "Alerte", attention: "Attention", info: "Information", positif: "Bonne nouvelle" } as const;

export function AlertesComex({ alertes }: { alertes: Alerte[] }) {
  if (alertes.length === 0) return <p style={{ margin: 0 }}>Aucun point d&apos;attention : tous les seuils sont respectés.</p>;
  return (
    <ul className="alertes">
      {alertes.map((a) => (
        <li key={a.titre} className={`alerte alerte-${a.niveau}`}>
          <span className="alerte-etiquette">{LIBELLES[a.niveau]}</span>
          <div>
            <strong>{a.titre}</strong>
            <p>{a.detail}</p>
          </div>
          {a.lien && (
            <Link href={a.lien} className="alerte-lien">
              Voir le détail →
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
