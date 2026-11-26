"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type Cellule = { t: string; v?: number | string | null; href?: string; classe?: string };
export type Colonne = { cle: string; libelle: string; num?: boolean; aide?: string };
export type Ligne = Record<string, Cellule>;

export function TableauDonnees({
  colonnes,
  lignes,
  taille = 12,
  recherche = true,
  nomExport = "export",
  triInitial,
}: {
  colonnes: Colonne[];
  lignes: Ligne[];
  taille?: number;
  recherche?: boolean;
  nomExport?: string;
  triInitial?: { cle: string; sens: "asc" | "desc" };
}) {
  const [tri, setTri] = useState(triInitial ?? null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const filtrees = useMemo(() => {
    const t = q.trim().toLowerCase();
    let l = t ? lignes.filter((x) => colonnes.some((c) => x[c.cle]?.t.toLowerCase().includes(t))) : lignes;
    if (tri) {
      const sens = tri.sens === "asc" ? 1 : -1;
      l = [...l].sort((a, b) => {
        const va = a[tri.cle]?.v ?? a[tri.cle]?.t ?? "";
        const vb = b[tri.cle]?.v ?? b[tri.cle]?.t ?? "";
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * sens;
        return String(va).localeCompare(String(vb), "fr") * sens;
      });
    }
    return l;
  }, [lignes, colonnes, q, tri]);
  const pages = Math.max(Math.ceil(filtrees.length / taille), 1);
  const courante = Math.min(page, pages - 1);
  const visibles = filtrees.slice(courante * taille, (courante + 1) * taille);
  const exporter = () => {
    const echapper = (s: string) => `"${s.replaceAll('"', '""')}"`;
    const csv = [colonnes.map((c) => echapper(c.libelle)).join(";"), ...filtrees.map((l) => colonnes.map((c) => echapper(l[c.cle]?.t ?? "")).join(";"))].join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomExport}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="tableau-donnees">
      <div className="tableau-outils">
        {recherche ? (
          <input type="search" placeholder="Rechercher" value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} aria-label="Rechercher dans le tableau" />
        ) : (
          <span />
        )}
        <span className="tableau-compte">{filtrees.length.toLocaleString("fr-FR")} lignes</span>
        <button type="button" className="bouton-lien" onClick={exporter}>
          Exporter en CSV
        </button>
      </div>
      <div className="tableau-defile">
        <table className="tableau">
          <thead>
            <tr>
              {colonnes.map((c) => (
                <th key={c.cle} className={c.num ? "num" : ""} aria-sort={tri?.cle === c.cle ? (tri.sens === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => setTri(tri?.cle === c.cle ? { cle: c.cle, sens: tri.sens === "asc" ? "desc" : "asc" } : { cle: c.cle, sens: c.num ? "desc" : "asc" })} title={c.aide}>
                    {c.libelle}
                    {tri?.cle === c.cle ? (tri.sens === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((l, i) => (
              <tr key={i}>
                {colonnes.map((c) => {
                  const cell = l[c.cle];
                  return (
                    <td key={c.cle} className={`${c.num ? "num" : ""} ${cell?.classe ?? ""}`}>
                      {cell?.href ? <Link href={cell.href}>{cell.t}</Link> : (cell?.t ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="tableau-pages">
          <button type="button" disabled={courante === 0} onClick={() => setPage(courante - 1)}>
            ← Précédent
          </button>
          <span>
            Page {courante + 1} sur {pages}
          </span>
          <button type="button" disabled={courante >= pages - 1} onClick={() => setPage(courante + 1)}>
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
