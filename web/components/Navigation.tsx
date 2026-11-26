"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LIENS = [
  { href: "/", libelle: "Synthèse" },
  { href: "/clients", libelle: "Clients" },
  { href: "/ventes", libelle: "Ventes" },
  { href: "/finance", libelle: "Finance" },
  { href: "/tresorerie", libelle: "Trésorerie" },
  { href: "/commercial", libelle: "Commercial" },
  { href: "/risque", libelle: "Risque" },
  { href: "/qualite", libelle: "Qualité" },
];

export function Navigation() {
  const chemin = usePathname();
  return (
    <nav className="navigation" aria-label="Navigation principale">
      {LIENS.map((l) => {
        const actif = l.href === "/" ? chemin === "/" : chemin.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={actif ? "page" : undefined}>
            {l.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
