export function Sparkline({ valeurs, couleur = "var(--accent)", largeur = 84, hauteur = 30 }: { valeurs: number[]; couleur?: string; largeur?: number; hauteur?: number }) {
  if (valeurs.length < 2) return null;
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const plage = max - min || 1;
  const x = (i: number) => (i / (valeurs.length - 1)) * (largeur - 4) + 2;
  const y = (v: number) => hauteur - 3 - ((v - min) / plage) * (hauteur - 8);
  const points = valeurs.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} width={largeur} height={hauteur} role="img" aria-label="Tendance sur 20 mois">
      <title>Tendance sur la période</title>
      <polyline points={points} fill="none" stroke={couleur} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(valeurs.length - 1)} cy={y(valeurs[valeurs.length - 1])} r={3} fill={couleur} />
    </svg>
  );
}
