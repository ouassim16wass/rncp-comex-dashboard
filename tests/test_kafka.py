import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import publication_kafka  # noqa: E402


class FauxProducteur:
    def __init__(self):
        self.messages = []

    def send(self, topic, value):
        self.messages.append((topic, value))

    def flush(self):
        pass


def deposer(dossier, route, lignes, complet=True):
    sortie = Path(dossier) / route.replace("/", "_") / "2026-11-24"
    sortie.mkdir(parents=True)
    nom = route.replace("/", "_") + "_100000"
    (sortie / f"{nom}.jsonl").write_text("\n".join(json.dumps(x) for x in lignes) + "\n", encoding="utf-8")
    controle = {"fichier": nom + ".jsonl", "lignes_recues": len(lignes), "complet": complet, "date_photo": "2026-11-24T10:00:00"}
    (sortie / f"{nom}.controle.json").write_text(json.dumps(controle), encoding="utf-8")


def test_nom_topic():
    assert publication_kafka.nom_topic("itop/tickets") == "brut.itop.tickets"


def test_publie_une_ligne_par_message(tmp_path):
    deposer(tmp_path, "itop/tickets", [{"Référence": "R-1"}, {"Référence": "R-2"}, {"Référence": "R-3"}])
    producteur = FauxProducteur()
    controle = publication_kafka.publier("itop/tickets", producteur=producteur, dossier=tmp_path)
    assert controle["messages"] == 3 and controle["complet"]
    topic, message = producteur.messages[2]
    assert topic == "brut.itop.tickets"
    assert message["numero_ligne"] == 3 and message["ligne"]["Référence"] == "R-3"
    assert message["date_photo"] == "2026-11-24T10:00:00"


def test_depot_incomplet_refuse(tmp_path):
    deposer(tmp_path, "itop/tickets", [{"a": 1}], complet=False)
    with pytest.raises(ValueError):
        publication_kafka.publier("itop/tickets", producteur=FauxProducteur(), dossier=tmp_path)


def test_sans_depot(tmp_path):
    with pytest.raises(FileNotFoundError):
        publication_kafka.publier("itop/tickets", producteur=FauxProducteur(), dossier=tmp_path)
