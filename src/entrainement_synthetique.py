import json
import sys
import tempfile
from pathlib import Path

import modele_risque
import registre
from jeu_synthetique import mensuel_synthetique


def main() -> int:
    sortie = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("resultat_entrainement_synthetique.json")
    with tempfile.TemporaryDirectory() as dossier:
        resultat = modele_risque.executer_pipeline(mensuel_synthetique(), Path(dossier))
        informations = registre.meta(resultat["version"], Path(dossier))
    resume = {
        "version": informations["version"],
        "accepte": resultat["accepte"],
        "raisons": resultat["raisons"],
        "commit_git": informations["commit_git"],
        "empreinte_jeu": informations["empreinte_jeu"],
        "resultats": informations["resultats"],
    }
    sortie.write_text(json.dumps(resume, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
    print(json.dumps({"accepte": resume["accepte"], "raisons": resume["raisons"]}, ensure_ascii=False))
    return 0 if resume["accepte"] else 1


if __name__ == "__main__":
    sys.exit(main())
