import type { Metadata } from "next";
import "@fontsource-variable/noto-sans";
import "./globals.css";
import "./shell.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { modeDemo } from "@/lib/db";

export const metadata: Metadata = {
  title: "Pilotage COMEX",
  description: "Santé financière, activité commerciale, clients et opérations de l'entreprise",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="app">
          <Sidebar demo={modeDemo} />
          <main className="canevas">{children}</main>
        </div>
      </body>
    </html>
  );
}
