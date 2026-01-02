import pandas as pd
from typing import List, Dict

def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)
    n = len(df)

    rows = []
    for c in df.columns:
        m = int(df[c].isna().sum())
        rows.append({
            "column": c,
            "missing": m,
            "ratio": m / n if n else 0,
        })
    return rows
