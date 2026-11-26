export function Kpi({
  titre,
  valeur,
  detail,
  ton,
}: {
  titre: string;
  valeur: string;
  detail?: string;
  ton?: "positif" | "alerte" | "danger";
}) {
  return (
    <div className="carte">
      <p className="kpi-titre">{titre}</p>
      <p className="kpi-valeur">{valeur}</p>
      {detail && <p className={`kpi-detail ${ton ? `ton-${ton}` : ""}`}>{detail}</p>}
    </div>
  );
}
