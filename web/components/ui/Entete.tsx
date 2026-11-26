import type { ReactNode } from "react";
import { FiltresGlobaux } from "@/components/shell/FiltresGlobaux";
import type { Contexte } from "@/lib/contexte";
import { libellePeriode } from "@/lib/format";
import { libelleMode } from "@/lib/periode";

export const SEGMENTS = ["Groupe", "Hors groupe", "Public", "Douteux", "Non classé"];
export const DOMAINES = ["D1", "D2", "D3", "D4", "HD"];

export function Entete({
  titre,
  question,
  ctx,
  modes = ["ytd", "12m", "mois"],
  filtres = true,
  segments = true,
  domaines = true,
  actions,
}: {
  titre: string;
  question: string;
  ctx?: Contexte;
  modes?: string[];
  filtres?: boolean;
  segments?: boolean;
  domaines?: boolean;
  actions?: ReactNode;
}) {
  return (
    <header className="page-entete">
      <div className="page-titre">
        <div>
          <h1>{titre}</h1>
          <p>{question}</p>
        </div>
        {ctx && (
          <p className="page-periode">
            À fin {libellePeriode(ctx.fin)} · {libelleMode(ctx.mode)}
            {ctx.comparable ? " · vs même période N-1" : ""}
          </p>
        )}
        {actions}
      </div>
      {ctx && filtres && (
        <FiltresGlobaux
          mois={ctx.mois}
          fin={ctx.fin}
          mode={ctx.mode}
          modes={modes}
          segments={segments ? SEGMENTS : []}
          domaines={domaines ? DOMAINES : []}
          segmentsChoisis={ctx.segments}
          domainesChoisis={ctx.domaines}
        />
      )}
    </header>
  );
}
