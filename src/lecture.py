from pathlib import Path

import pandas as pd

RACINE = Path(__file__).resolve().parent.parent
SOURCES = RACINE / "donnees_confidentielles"
CACHE = SOURCES / "cache"


def en_tete_auto(brut: pd.DataFrame, debut=0, fin=20) -> int:
    return int(brut.iloc[debut:fin].notna().sum(axis=1).idxmax())


def lire(nom: str, feuille=0, salesforce=False) -> pd.DataFrame:
    CACHE.mkdir(exist_ok=True)
    cache = CACHE / (Path(nom).stem.replace(" ", "_") + ".parquet")
    if cache.exists():
        return pd.read_parquet(cache)
    if salesforce:
        brut = pd.read_excel(SOURCES / nom, header=None)
        h = en_tete_auto(brut)
        df = brut.iloc[h + 1 :].copy()
        df.columns = [f"colonne_{i}" if pd.isna(c) else str(c) for i, c in enumerate(brut.iloc[h])]
    else:
        df = pd.read_excel(SOURCES / nom, sheet_name=feuille)
    df = df.dropna(how="all")
    df.columns = [str(c).replace("\n", " ").strip() for c in df.columns]
    for c in df.columns[df.dtypes == "object"]:
        df[c] = df[c].astype("string")
    df.to_parquet(cache)
    return df
