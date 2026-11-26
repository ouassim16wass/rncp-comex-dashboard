import { Sparkline } from "@/components/Sparkline";
import { Info } from "./Tuile";

export type Delta = { ratio: number | null; absolu?: string; bonSens?: "hausse" | "baisse"; libelle?: string; points?: boolean };

function Pastille({ d }: { d: Delta }) {
  if (d.ratio === null || Number.isNaN(d.ratio)) return <span className="delta delta-neutre">{d.libelle ?? "Comparaison indisponible"}</span>;
  const monte = d.ratio >= 0;
  const bon = (d.bonSens ?? "hausse") === "hausse" ? monte : !monte;
  const neutre = Math.abs(d.ratio) < 0.005;
  return (
    <span className={`delta ${neutre ? "delta-neutre" : bon ? "delta-bon" : "delta-mauvais"}`}>
      {monte ? "▲" : "▼"} {monte ? "+" : ""}
      {(d.ratio * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} {d.points ? "pts" : "%"}{d.absolu ? ` · ${d.absolu}` : ""}
      <small> {d.libelle ?? "vs an dernier"}</small>
    </span>
  );
}

export function Kpi({
  titre,
  valeur,
  delta,
  detail,
  serie,
  aide,
  lien,
  classe = "c3",
}: {
  titre: string;
  valeur: string;
  delta?: Delta;
  detail?: string;
  serie?: number[];
  aide?: string;
  lien?: string;
  classe?: string;
}) {
  const corps = (
    <>
      <p className="kpi-t">
        {titre}
        {aide && <Info texte={aide} />}
      </p>
      <div className="kpi-l">
        <p className="kpi-v">{valeur}</p>
        {serie && <Sparkline valeurs={serie} />}
      </div>
      {delta && <p className="kpi-d">
        <Pastille d={delta} />
      </p>}
      {detail && <p className="kpi-s">{detail}</p>}
    </>
  );
  return lien ? (
    <a href={lien} className={`tuile kpi kpi-lien ${classe}`}>
      {corps}
    </a>
  ) : (
    <div className={`tuile kpi ${classe}`}>{corps}</div>
  );
}
