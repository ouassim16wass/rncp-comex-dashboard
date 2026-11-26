const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function euros(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (abs >= 1e4) return `${Math.round(n / 1e3).toLocaleString("fr-FR")} k€`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€`;
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

export function pct(x: number | null | undefined, decimales = 1): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  const arrondi = Number((x * 100).toFixed(decimales));
  return `${(arrondi === 0 ? 0 : arrondi).toLocaleString("fr-FR", { maximumFractionDigits: decimales })} %`;
}

export function variation(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  const signe = x > 0 ? "+" : "";
  return `${signe}${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export function libellePeriode(periode: number): string {
  return `${MOIS[(periode % 100) - 1]} ${Math.floor(periode / 100)}`;
}

export function libelleMois(mois: number): string {
  return MOIS[mois - 1];
}

export function libelleDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
