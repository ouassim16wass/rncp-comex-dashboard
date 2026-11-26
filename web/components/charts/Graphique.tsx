"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { echarts } from "./echarts";
import { euros, pct } from "@/lib/format";

export type FormatGraphique = "euro" | "pct" | "nombre" | "jours" | "decimal";

export type Clic = { param: string; sur: "nom" | "categorie"; valeurs?: string[] };

const formateur = (format: FormatGraphique) => (v: unknown): string => {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? "");
  if (format === "euro") return euros(n);
  if (format === "pct") return pct(n, 1);
  if (format === "decimal") return n.toLocaleString("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (format === "jours") return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} j`;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
};

type Option = Record<string, unknown>;

function finaliser(option: Option, format: FormatGraphique): Option {
  const fmt = formateur(format);
  const copie = JSON.parse(JSON.stringify(option)) as Option;
  const axes = ["xAxis", "yAxis"] as const;
  for (const a of axes) {
    const liste = Array.isArray(copie[a]) ? (copie[a] as Option[]) : copie[a] ? [copie[a] as Option] : [];
    for (const axe of liste) {
      if (axe.type === "value" || axe.type === "log") {
        const label = (axe.axisLabel ?? {}) as Option;
        const fmtAxe = axe.formatAxe === "pct" ? formateur("pct") : axe.formatAxe === "nombre" ? formateur("nombre") : axe.formatAxe === "euro" ? formateur("euro") : fmt;
        label.formatter = (v: number) => fmtAxe(v);
        axe.axisLabel = label;
      }
    }
  }
  const tooltip = (copie.tooltip ?? {}) as Option;
  tooltip.valueFormatter = (v: unknown) => fmt(v);
  if (copie.tooltip !== undefined || tooltip.trigger) copie.tooltip = tooltip;
  const series = (copie.series as Option[] | undefined) ?? [];
  for (const s of series) {
    const label = s.label as Option | undefined;
    if (label && label.formatter === "@fmt") label.formatter = (p: { value: unknown }) => fmt(Array.isArray(p.value) ? p.value[p.value.length - 1] : p.value);
    if (label && label.formatter === "@pct") label.formatter = (p: { value: unknown }) => formateur("pct")(p.value);
    if (s.formatSerie) {
      const t = (s.tooltip ?? {}) as Option;
      t.valueFormatter = formateur(s.formatSerie as FormatGraphique);
      s.tooltip = t;
    }
    if (s.type === "pie" || s.type === "treemap" || s.type === "funnel") {
      const t = (s.tooltip ?? {}) as Option;
      t.valueFormatter = (v: unknown) => fmt(v);
      s.tooltip = t;
    }
  }
  return copie;
}

export function Graphique({
  option,
  hauteur = 300,
  format = "euro",
  clic,
  titre,
}: {
  option: Option;
  hauteur?: number;
  format?: FormatGraphique;
  clic?: Clic;
  titre: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const routeur = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const courants = params.toString();

  useEffect(() => {
    if (!ref.current) return;
    const graphique = echarts.init(ref.current, "entreprise", { renderer: "canvas" });
    graphique.setOption(finaliser({ animationDuration: 500, ...option }, format) as never);
    if (clic) {
      graphique.on("click", (e) => {
        const nom = clic.sur === "nom" ? e.seriesName : (e.name as string);
        if (!nom || nom === "Autres" || (clic.valeurs && !clic.valeurs.includes(nom))) return;
        const q = new URLSearchParams(courants);
        const actuelles = (q.get(clic.param) ?? "").split("|").filter(Boolean);
        const suivantes = actuelles.includes(nom) ? actuelles.filter((x) => x !== nom) : [nom];
        if (suivantes.length) q.set(clic.param, suivantes.join("|"));
        else q.delete(clic.param);
        routeur.push(`${chemin}?${q.toString()}`, { scroll: false });
      });
    }
    const observateur = new ResizeObserver(() => graphique.resize());
    observateur.observe(ref.current);
    return () => {
      observateur.disconnect();
      graphique.dispose();
    };
  }, [option, format, clic, courants, chemin, routeur]);

  return <div ref={ref} role="img" aria-label={titre} style={{ width: "100%", height: hauteur }} />;
}
