"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

const ICONES: Record<string, ReactNode> = {
  synthese: <path d="M3 12 12 3l9 9M5 10v10h5v-6h4v6h5V10" />,
  activite: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  clients: <path d="M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1m8-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9 9v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />,
  finance: <path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5 9.2 9.5 12 10s5 1.4 5 3.5-2.2 3-5 3-5-1.1-5-3" />,
  tresorerie: <path d="M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2" />,
  commercial: <path d="M3 4h18l-7 8v6l-4 2v-8z" />,
  operations: <path d="m14.7 6.3 3 3-9.4 9.4H5.3v-3zM13 8l3 3" />,
  risque: <path d="M12 3 2 20h20zM12 10v4m0 3h.01" />,
  analyse: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-4.3-4.3" />,
  modele: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  qualite: <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6zM9 12l2 2 4-4" />,
};

const GROUPES = [
  {
    titre: "Pilotage",
    liens: [
      { href: "/", libelle: "Synthèse", icone: "synthese" },
      { href: "/activite", libelle: "Activité", icone: "activite" },
      { href: "/clients", libelle: "Clients", icone: "clients" },
      { href: "/finance", libelle: "Finance", icone: "finance" },
      { href: "/tresorerie", libelle: "Trésorerie", icone: "tresorerie" },
      { href: "/commercial", libelle: "Commercial", icone: "commercial" },
      { href: "/operations", libelle: "Opérations", icone: "operations" },
      { href: "/risque", libelle: "Risque clients", icone: "risque" },
    ],
  },
  {
    titre: "Outils",
    liens: [
      { href: "/analyse", libelle: "Analyse libre", icone: "analyse" },
      { href: "/modele", libelle: "Suivi du modèle", icone: "modele" },
      { href: "/qualite", libelle: "Fiabilité des données", icone: "qualite" },
    ],
  },
];

export function Sidebar({ demo }: { demo: boolean }) {
  const chemin = usePathname();
  return (
    <aside className="lateral">
      <div className="lateral-marque">
        <Logo hauteur={26} />
        <span>COMEX</span>
      </div>
      <nav aria-label="Navigation principale">
        {GROUPES.map((g) => (
          <div key={g.titre} className="lateral-groupe">
            <p>{g.titre}</p>
            {g.liens.map((l) => {
              const actif = l.href === "/" ? chemin === "/" : chemin.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} aria-current={actif ? "page" : undefined}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICONES[l.icone]}
                  </svg>
                  {l.libelle}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="lateral-pied">
        <span className={`mode ${demo ? "mode-demo" : "mode-prod"}`}>{demo ? "Données de démonstration" : "Données internes · confidentiel"}</span>
        <small>Sources : Sage, Salesforce, iTop</small>
      </div>
    </aside>
  );
}
