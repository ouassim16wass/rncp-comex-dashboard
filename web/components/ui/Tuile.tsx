import type { ReactNode } from "react";

export function Info({ texte }: { texte: string }) {
  return (
    <span className="info" tabIndex={0} role="note" aria-label={texte} data-aide={texte}>
      i
    </span>
  );
}

export function Tuile({
  titre,
  sousTitre,
  aide,
  classe = "c6",
  actions,
  children,
  plein = false,
}: {
  titre: string;
  sousTitre?: string;
  aide?: string;
  classe?: string;
  actions?: ReactNode;
  children: ReactNode;
  plein?: boolean;
}) {
  return (
    <section className={`tuile ${classe}`}>
      <header className="tuile-entete">
        <div>
          <h2>
            {titre}
            {aide && <Info texte={aide} />}
          </h2>
          {sousTitre && <p>{sousTitre}</p>}
        </div>
        {actions && <div className="tuile-actions">{actions}</div>}
      </header>
      <div className={plein ? "tuile-corps tuile-plein" : "tuile-corps"}>{children}</div>
    </section>
  );
}
