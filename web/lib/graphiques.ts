import { PALETTE } from "@/components/charts/echarts";

type Option = Record<string, unknown>;

export type SerieOption = {
  nom: string;
  valeurs: (number | null)[];
  type?: "bar" | "line";
  couleur?: string;
  empile?: boolean;
  axe?: 0 | 1;
  aire?: boolean;
  etiquettes?: boolean;
  format?: "pct" | "nombre" | "euro" | "jours";
};

const grille = { left: 8, right: 16, top: 36, bottom: 8, containLabel: true };

export function couleurPour(nom: string, i: number): string {
  return nom === "Autres" ? "#aaaaaa" : PALETTE[i % PALETTE.length];
}

export function optionSeries(categories: string[], series: SerieOption[], opts: { zoom?: boolean; legende?: boolean; pct?: boolean; axeDroite?: "pct" | "nombre" } = {}): Option {
  const deuxAxes = series.some((s) => s.axe === 1);
  const empiles = series.filter((s) => s.empile && (s.axe ?? 0) === 0);
  let plafond = 0;
  let plancher = 0;
  categories.forEach((_, i) => {
    if (empiles.length) {
      plafond = Math.max(plafond, empiles.reduce((t, s) => t + Math.max(s.valeurs[i] ?? 0, 0), 0));
      plancher = Math.min(plancher, empiles.reduce((t, s) => t + Math.min(s.valeurs[i] ?? 0, 0), 0));
    }
    for (const s of series.filter((x) => !x.empile && (x.axe ?? 0) === 0)) {
      plafond = Math.max(plafond, s.valeurs[i] ?? 0);
      plancher = Math.min(plancher, s.valeurs[i] ?? 0);
    }
  });
  const negligeable = plafond > 0 && Math.abs(plancher) < plafond * 0.03;
  return {
    grid: { ...grille, bottom: opts.zoom ? 38 : 8, top: opts.legende === false ? 12 : 36 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: opts.legende === false ? { show: false } : { top: 0, type: "scroll" },
    xAxis: { type: "category", data: categories, axisLabel: categories.length <= 14 ? { interval: 0, width: 80, overflow: "break" } : { hideOverlap: true } },
    yAxis: deuxAxes
      ? [{ type: "value", ...(negligeable ? { min: 0 } : {}) }, { type: "value", position: "right", splitLine: { show: false }, formatAxe: opts.axeDroite ?? "pct" }]
      : { type: "value", ...(opts.pct ? { max: 1 } : {}), ...(negligeable ? { min: 0 } : {}) },
    dataZoom: opts.zoom ? [{ type: "inside" }, { type: "slider", height: 18, bottom: 6, borderColor: "#cddeef" }] : undefined,
    series: series.map((s, i) => ({
      name: s.nom,
      type: s.type ?? "bar",
      data: s.valeurs,
      stack: s.empile ? "total" : undefined,
      yAxisIndex: s.axe ?? 0,
      formatSerie: s.format,
      smooth: false,
      symbolSize: 6,
      areaStyle: s.aire ? { opacity: 0.22 } : undefined,
      itemStyle: { color: s.couleur ?? couleurPour(s.nom, i), borderRadius: s.type === "line" ? 0 : s.empile ? 0 : [3, 3, 0, 0] },
      lineStyle: { width: 2.4, color: s.couleur ?? couleurPour(s.nom, i) },
      emphasis: { focus: "series" },
      label: s.etiquettes ? { show: true, formatter: "@fmt", fontSize: 10, position: s.type === "line" ? "top" : "inside" } : undefined,
    })),
  };
}

export function optionBarresHorizontales(elements: { libelle: string; valeur: number; couleur?: string }[], opts: { comparaison?: { nom: string; valeurs: number[] }; nom?: string } = {}): Option {
  const triees = [...elements].reverse();
  const series: Option[] = [
    {
      name: opts.nom ?? "Valeur",
      type: "bar",
      data: triees.map((e) => ({ value: e.valeur, itemStyle: { color: e.couleur ?? "#008ae0", borderRadius: [0, 3, 3, 0] } })),
      label: { show: true, position: "right", formatter: "@fmt", fontSize: 11, color: "#003d4c" },
      barMaxWidth: 22,
    },
  ];
  if (opts.comparaison)
    series.unshift({
      name: opts.comparaison.nom,
      type: "bar",
      data: [...opts.comparaison.valeurs].reverse(),
      itemStyle: { color: "#cddeef", borderRadius: [0, 3, 3, 0] },
      barMaxWidth: 22,
    });
  return {
    grid: { left: 8, right: 64, top: opts.comparaison ? 28 : 8, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: opts.comparaison ? { top: 0 } : { show: false },
    xAxis: { type: "value", splitLine: { lineStyle: { color: "#e3ecf5" } } },
    yAxis: { type: "category", data: triees.map((e) => e.libelle), axisLabel: { width: 150, overflow: "truncate" } },
    series,
  };
}

export function optionPont(debut: number, fin: number, libelleDebut: string, libelleFin: string, elements: { label: string; delta: number }[]): Option {
  const categories = [libelleDebut, ...elements.map((e) => e.label), libelleFin];
  let cumul = debut;
  const base: (number | null)[] = [0];
  const hausse: (number | null)[] = [null];
  const baisse: (number | null)[] = [null];
  const totaux: (number | null)[] = [debut];
  for (const e of elements) {
    const suivant = cumul + e.delta;
    base.push(Math.min(cumul, suivant));
    hausse.push(e.delta >= 0 ? e.delta : null);
    baisse.push(e.delta < 0 ? -e.delta : null);
    totaux.push(null);
    cumul = suivant;
  }
  base.push(0);
  hausse.push(null);
  baisse.push(null);
  totaux.push(fin);
  const bas = Math.min(debut, fin, ...base.filter((b): b is number => b !== null && b > 0));
  const plafond = Math.max(debut, fin, cumul);
  const plancher = Math.max(0, Math.floor((bas - (plafond - bas) * 0.3) / 1e5) * 1e5);
  return {
    grid: { ...grille, top: 24 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "category", data: categories, axisLabel: { interval: 0, width: 72, overflow: "break" } },
    yAxis: { type: "value", min: plancher },
    series: [
      { name: "base", type: "bar", stack: "pont", data: base, itemStyle: { color: "transparent" }, tooltip: { show: false }, silent: true },
      { name: "Hausse", type: "bar", stack: "pont", data: hausse, itemStyle: { color: "#5bc500", borderRadius: 3 }, label: { show: true, position: "top", formatter: "@fmt", fontSize: 11, color: "#2f7d00" } },
      { name: "Baisse", type: "bar", stack: "pont", data: baisse, itemStyle: { color: "#d31205", borderRadius: 3 }, label: { show: true, position: "top", formatter: "@fmt", fontSize: 11, color: "#d31205" } },
      { name: "Total", type: "bar", stack: "pont", data: totaux, itemStyle: { color: "#141c52", borderRadius: 3 }, label: { show: true, position: "top", formatter: "@fmt", fontSize: 11, color: "#141c52", fontWeight: 700 } },
    ],
  };
}

export function optionPareto(libelles: string[], parts: number[], cumuls: number[]): Option {
  return {
    grid: { ...grille, top: 30 },
    tooltip: { trigger: "axis" },
    legend: { top: 0 },
    xAxis: { type: "category", data: libelles.map((_, i) => String(i + 1)), name: "Rang du client", nameLocation: "middle", nameGap: 26 },
    yAxis: [
      { type: "value", formatAxe: "pct" },
      { type: "value", max: 1, position: "right", splitLine: { show: false }, formatAxe: "pct" },
    ],
    series: [
      { name: "Part du CA", type: "bar", data: parts, itemStyle: { color: "#008ae0", borderRadius: [3, 3, 0, 0] } },
      { name: "Part cumulée", type: "line", yAxisIndex: 1, data: cumuls, itemStyle: { color: "#141c52" }, lineStyle: { width: 2.4 }, symbolSize: 6 },
    ],
  };
}

export function optionTreemap(noeuds: { name: string; value: number; children?: { name: string; value: number }[] }[]): Option {
  return {
    tooltip: {},
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: "zoomToNode",
        breadcrumb: { show: true, bottom: 0, itemStyle: { color: "#141c52" } },
        label: { show: true, formatter: "{b}", fontSize: 12 },
        upperLabel: { show: true, height: 22, color: "#fff" },
        itemStyle: { borderColor: "#fff", borderWidth: 2, gapWidth: 2 },
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: 3 }, upperLabel: { show: false } },
          { colorSaturation: [0.35, 0.65], itemStyle: { borderColorSaturation: 0.7, gapWidth: 2, borderWidth: 2 } },
        ],
        data: noeuds.map((n, i) => ({ ...n, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      },
    ],
  };
}

export function optionEntonnoir(etapes: { nom: string; valeur: number }[]): Option {
  return {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "funnel",
        sort: "descending",
        left: "6%",
        right: "6%",
        top: 8,
        bottom: 8,
        gap: 3,
        label: { show: true, position: "inside", formatter: "{b}", color: "#fff", fontSize: 12 },
        itemStyle: { borderColor: "#fff", borderWidth: 1 },
        data: etapes.map((e, i) => ({ name: e.nom, value: e.valeur, itemStyle: { color: ["#141c52", "#44437f", "#008ae0", "#3fcce3", "#5bc500"][i % 5] } })),
      },
    ],
  };
}

export function optionNuage(
  points: { nom: string; x: number; y: number; taille: number; groupe: string }[],
  groupes: { nom: string; couleur: string }[],
  axes: { x: string; y: string; formatY?: "pct" | "nombre"; logX?: boolean; logY?: boolean },
): Option {
  return {
    grid: { left: 8, right: 24, top: 52, bottom: 24, containLabel: true },
    legend: { top: 0, data: groupes.map((g) => g.nom) },
    tooltip: { trigger: "item", formatter: "{b}" },
    xAxis: { type: axes.logX ? "log" : "value", name: axes.x, nameLocation: "middle", nameGap: 28, splitLine: { lineStyle: { color: "#e3ecf5" } }, formatAxe: "euro" },
    yAxis: { type: axes.logY ? "log" : "value", name: axes.y, nameLocation: "end", nameTextStyle: { align: "left" }, formatAxe: axes.formatY ?? "pct", splitLine: { lineStyle: { color: "#e3ecf5" } } },
    series: groupes.map((g) => ({
      name: g.nom,
      type: "scatter",
      itemStyle: { color: g.couleur, opacity: 0.78 },
      data: points.filter((p) => p.groupe === g.nom).map((p) => ({ name: p.nom, value: [p.x, p.y], symbolSize: p.taille })),
    })),
  };
}

export function optionCarte(lignes: string[], colonnes: string[], valeurs: [number, number, number][], max: number): Option {
  return {
    grid: { left: 8, right: 16, top: 8, bottom: 44, containLabel: true },
    tooltip: { position: "top" },
    xAxis: { type: "category", data: colonnes, splitArea: { show: true }, axisLabel: { interval: 0, width: 78, overflow: "break", fontSize: 10 } },
    yAxis: { type: "category", data: lignes, splitArea: { show: true } },
    visualMap: { min: 0, max, calculable: false, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#eef4fa", "#008ae0", "#141c52"] }, show: false },
    series: [{ type: "heatmap", data: valeurs, label: { show: true, formatter: "@fmt", fontSize: 10 }, emphasis: { itemStyle: { shadowBlur: 6 } } }],
  };
}

export function optionDonut(elements: { nom: string; valeur: number }[], couleurs?: string[]): Option {
  return {
    tooltip: { trigger: "item" },
    legend: { bottom: 0, type: "scroll" },
    series: [
      {
        type: "pie",
        radius: ["52%", "76%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontWeight: 700 } },
        data: elements.map((e, i) => ({ name: e.nom, value: e.valeur, itemStyle: { color: couleurs?.[i] ?? PALETTE[i % PALETTE.length] } })),
      },
    ],
  };
}


export function optionContributions(elements: { label: string; valeur: number }[]): Option {
  return {
    grid: { left: 8, right: 70, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", splitLine: { lineStyle: { color: "#e3ecf5" } } },
    yAxis: { type: "category", data: [...elements].reverse().map((e) => e.label), axisLine: { show: true }, axisLabel: { width: 110, overflow: "truncate" } },
    series: [
      {
        name: "Contribution",
        type: "bar",
        barMaxWidth: 26,
        label: { show: true, formatter: "@fmt", fontSize: 11, color: "#003d4c" },
        data: [...elements].reverse().map((e) => ({ value: e.valeur, label: { position: e.valeur >= 0 ? "right" : "left" }, itemStyle: { color: e.valeur >= 0 ? "#5bc500" : "#d31205", borderRadius: e.valeur >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3] } })),
      },
    ],
  };
}
