import { NextResponse, type NextRequest } from "next/server";

function identifiants(entete: string): [string, string] | null {
  const [type, valeur] = entete.split(" ");
  if (type !== "Basic" || !valeur) return null;
  try {
    const decode = atob(valeur);
    const separateur = decode.indexOf(":");
    return separateur < 0 ? null : [decode.slice(0, separateur), decode.slice(separateur + 1)];
  } catch {
    return null;
  }
}

export function middleware(requete: NextRequest) {
  const utilisateur = process.env.DASHBOARD_UTILISATEUR;
  const motDePasse = process.env.DASHBOARD_MOT_DE_PASSE;
  if (!utilisateur || !motDePasse) {
    return process.env.MODE_DEMO !== "0" ? NextResponse.next() : new NextResponse("Authentification non configurée : accès refusé", { status: 503 });
  }
  const fournis = identifiants(requete.headers.get("authorization") ?? "");
  if (fournis && fournis[0] === utilisateur && fournis[1] === motDePasse) return NextResponse.next();
  return new NextResponse("Authentification requise", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Pilotage COMEX", charset="UTF-8"' } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/sante).*)"] };
