"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Affichage } from "@/lib/analyse";
import type { Cube, Grain } from "@/lib/cubes";
import type { ValeurFiltre } from "@/lib/executer";
import type { Etat } from "@/lib/filtres";
import { versUrl } from "@/lib/filtres";

function libelleMois(valeur: string): string {
  const mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  if (/^\d{6}$/.test(valeur)) return `${mois[Number(valeur.slice(4)) - 1]} ${valeur.slice(0, 4)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return new Date(valeur).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  return valeur;
}

function FiltreMulti({
  libelle,
  valeurs,
  choisies,
  onChange,
}: {
  libelle: string;
  valeurs: ValeurFiltre[];
  choisies: string[];
  onChange: (liste: string[]) => void;
}) {
  const [recherche, setRecherche] = useState("");
  const racine = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (racine.current?.open && !racine.current.contains(e.target as Node)) racine.current.open = false;
    };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, []);
  const visibles = valeurs.filter((v) => v.valeur.toLowerCase().includes(recherche.toLowerCase())).slice(0, 120);
  const basculer = (v: string) => onChange(choisies.includes(v) ? choisies.filter((x) => x !== v) : [...choisies, v]);
  return (
    <details className="filtre" ref={racine}>
      <summary className={choisies.length ? "actif" : ""}>
        {libelle}
        {choisies.length > 0 && <b>{choisies.length}</b>}
      </summary>
      <div className="filtre-panneau">
        {valeurs.length > 8 && (
          <input
            type="search"
            placeholder="Rechercher"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label={`Rechercher dans ${libelle}`}
          />
        )}
        <div className="filtre-liste">
          {visibles.map((v) => (
            <label key={v.valeur}>
              <input type="checkbox" checked={choisies.includes(v.valeur)} onChange={() => basculer(v.valeur)} />
              <span>{v.valeur}</span>
              <small>{v.n.toLocaleString("fr-FR")}</small>
            </label>
          ))}
          {visibles.length === 0 && <p className="note">Aucun résultat</p>}
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

export function BarreFiltres({
  cube,
  etat,
  periodes,
  valeurs,
}: {
  cube: Cube;
  etat: Etat;
  periodes: string[];
  valeurs: Record<string, ValeurFiltre[]>;
}) {
  const routeur = useRouter();
  const chemin = usePathname();
  const parametresUrl = useSearchParams();
  const cubeUrl = parametresUrl.get("cube");
  const [, demarrer] = useTransition();
  const mensuel = cube.temps.type === "mensuel";
  const naviguer = (modif: Partial<Etat>) => {
    demarrer(() => routeur.push(versUrl(cubeUrl ? `${chemin}?cube=${cubeUrl}` : chemin, { ...etat, ...modif }), { scroll: false }));
  };
  const actifs = Object.values(etat.filtres).filter((l) => l.length).length + (etat.du ? 1 : 0) + (etat.au ? 1 : 0);
  const mesure = cube.mesures.find((m) => m.cle === etat.mesure);
  return (
    <section className="barre" aria-label="Filtres et axes d'analyse">
      <div className="barre-ligne">
        <label>
          Du
          <select value={etat.du ?? ""} onChange={(e) => naviguer({ du: e.target.value || undefined })}>
            <option value="">Début</option>
            {periodes.map((p) => (
              <option key={p} value={p}>
                {libelleMois(p)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Au
          <select value={etat.au ?? ""} onChange={(e) => naviguer({ au: e.target.value || undefined })}>
            <option value="">Fin</option>
            {periodes.map((p) => (
              <option key={p} value={p}>
                {libelleMois(p)}
              </option>
            ))}
          </select>
        </label>
        {mensuel && etat.colonnes === "temps" && (
          <fieldset className="segment" aria-label="Granularité">
            {(["mois", "trimestre", "annee"] as Grain[]).map((g) => (
              <button key={g} type="button" aria-pressed={etat.grain === g} onClick={() => naviguer({ grain: g })}>
                {g === "mois" ? "Mois" : g === "trimestre" ? "Trimestre" : "Année"}
              </button>
            ))}
          </fieldset>
        )}
        {cube.temps.type === "mensuel" && cube.temps.axes.length > 1 && (
          <fieldset className="segment" aria-label="Calendrier">
            <button type="button" aria-pressed={etat.axe === "sage"} onClick={() => naviguer({ axe: "sage" })}>
              Mois Sage
            </button>
            <button type="button" aria-pressed={etat.axe === "civil"} onClick={() => naviguer({ axe: "civil" })}>
              Date de facture
            </button>
          </fieldset>
        )}
        {cube.cle === "facturation" && (
          <label className="case">
            <input type="checkbox" checked={etat.inclure990} onChange={(e) => naviguer({ inclure990: e.target.checked })} />
            Inclure le service 990
          </label>
        )}
      </div>
      <div className="barre-ligne">
        <label>
          Mesure
          <select value={etat.mesure} onChange={(e) => naviguer({ mesure: e.target.value, affichage: "valeur" as Affichage })}>
            {cube.mesures.map((m) => (
              <option key={m.cle} value={m.cle}>
                {m.libelle}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lignes
          <select value={etat.lignes} onChange={(e) => naviguer({ lignes: e.target.value, colonnes: e.target.value === etat.colonnes ? "temps" : etat.colonnes })}>
            <option value="aucun">Aucune (total)</option>
            {cube.dimensions.map((d) => (
              <option key={d.cle} value={d.cle}>
                {d.libelle}
              </option>
            ))}
          </select>
        </label>
        <label>
          Colonnes
          <select value={etat.colonnes} onChange={(e) => naviguer({ colonnes: e.target.value })}>
            <option value="temps">Temps</option>
            {cube.dimensions
              .filter((d) => d.cle !== etat.lignes)
              .map((d) => (
                <option key={d.cle} value={d.cle}>
                  {d.libelle}
                </option>
              ))}
          </select>
        </label>
        <label>
          Affichage
          <select value={etat.affichage} onChange={(e) => naviguer({ affichage: e.target.value as Affichage })}>
            <option value="valeur">Valeurs</option>
            {mesure?.additive && <option value="part">Répartition en %</option>}
            {mesure?.additive && etat.colonnes === "temps" && <option value="cumul">Cumul</option>}
            {etat.colonnes === "temps" && etat.grain !== undefined && cube.temps.type === "mensuel" && (
              <option value="variation">Variation sur un an</option>
            )}
          </select>
        </label>
        <label>
          Afficher
          <select value={etat.top} onChange={(e) => naviguer({ top: Number(e.target.value) })}>
            {[5, 8, 12, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n} lignes
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="barre-ligne barre-filtres">
        <span className="barre-titre">Filtrer</span>
        {cube.dimensions.map((d) => (
          <FiltreMulti
            key={d.cle}
            libelle={d.libelle}
            valeurs={valeurs[d.cle] ?? []}
            choisies={etat.filtres[d.cle] ?? []}
            onChange={(liste) => naviguer({ filtres: { ...etat.filtres, [d.cle]: liste } })}
          />
        ))}
        {actifs > 0 && (
          <button type="button" className="lien" onClick={() => naviguer({ filtres: {}, du: undefined, au: undefined })}>
            Réinitialiser ({actifs})
          </button>
        )}
      </div>
    </section>
  );
}
