"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function Multi({ libelle, options, choisies, onChange }: { libelle: string; options: string[]; choisies: string[]; onChange: (l: string[]) => void }) {
  const racine = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (racine.current?.open && !racine.current.contains(e.target as Node)) racine.current.open = false;
    };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, []);
  return (
    <details className="filtre" ref={racine}>
      <summary className={choisies.length ? "actif" : ""}>
        {libelle}
        {choisies.length > 0 && <b>{choisies.length}</b>}
      </summary>
      <div className="filtre-panneau">
        <div className="filtre-liste">
          {options.map((o) => (
            <label key={o}>
              <input type="checkbox" checked={choisies.includes(o)} onChange={() => onChange(choisies.includes(o) ? choisies.filter((x) => x !== o) : [...choisies, o])} />
              <span>{o}</span>
            </label>
          ))}
        </div>
        {choisies.length > 0 && (
          <button type="button" className="lien" onClick={() => onChange([])}>
            Tout désélectionner
          </button>
        )}
      </div>
    </details>
  );
}

export function FiltresGlobaux({
  mois,
  fin,
  mode,
  modes,
  segments,
  domaines,
  segmentsChoisis,
  domainesChoisis,
}: {
  mois: number[];
  fin: number;
  mode: string;
  modes: string[];
  segments: string[];
  domaines: string[];
  segmentsChoisis: string[];
  domainesChoisis: string[];
}) {
  const routeur = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const [attente, demarrer] = useTransition();
  const maj = (modif: Record<string, string | undefined>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(modif)) {
      if (v === undefined || v === "") q.delete(k);
      else q.set(k, v);
    }
    demarrer(() => routeur.push(`${chemin}?${q.toString()}`, { scroll: false }));
  };
  const nbFiltres = segmentsChoisis.length + domainesChoisis.length;
  return (
    <div className={`filtres-globaux ${attente ? "chargement" : ""}`} role="group" aria-label="Filtres de la page">
      <label>
        Mois d&apos;analyse
        <select value={fin} onChange={(e) => maj({ p: e.target.value })}>
          {[...mois].reverse().map((p) => (
            <option key={p} value={p}>
              {MOIS[(p % 100) - 1]} {Math.floor(p / 100)}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="segment" aria-label="Fenêtre d'analyse">
        {modes.includes("ytd") && (
          <button type="button" aria-pressed={mode === "ytd"} onClick={() => maj({ mode: "ytd" })}>
            Cumul annuel
          </button>
        )}
        {modes.includes("12m") && (
          <button type="button" aria-pressed={mode === "12m"} onClick={() => maj({ mode: "12m" })}>
            12 mois glissants
          </button>
        )}
        {modes.includes("mois") && (
          <button type="button" aria-pressed={mode === "mois"} onClick={() => maj({ mode: "mois" })}>
            Mois
          </button>
        )}
      </fieldset>
      {segments.length > 0 && <Multi libelle="Segment" options={segments} choisies={segmentsChoisis} onChange={(l) => maj({ seg: l.join("|") })} />}
      {domaines.length > 0 && <Multi libelle="Domaine" options={domaines} choisies={domainesChoisis} onChange={(l) => maj({ dom: l.join("|") })} />}
      {nbFiltres > 0 && (
        <button type="button" className="lien" onClick={() => maj({ seg: undefined, dom: undefined })}>
          Réinitialiser ({nbFiltres})
        </button>
      )}
    </div>
  );
}
