import pandas as pd
from typing import List, Dict

def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)

    rows = []
    for c in df.columns:
        rows.append({
            "column": c,
            "unique": int(df[c].nunique(dropna=True)),
        })
    return rows
