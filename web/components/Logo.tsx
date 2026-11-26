export function Logo({ hauteur = 32 }: { hauteur?: number }) {
  return (
    <span
      role="img"
      aria-label="Entreprise"
      style={{ fontSize: hauteur * 0.55, fontWeight: 700, letterSpacing: "0.14em", lineHeight: 1 }}
    >
      ENTREPRISE
    </span>
  );
}
