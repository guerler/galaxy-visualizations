from typing import Dict, List

import pandas as pd


def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)
    n = len(df)

    rows = []
    for c in df.columns:
        m = int(df[c].isna().sum())
        rows.append(
            {
                "column": c,
                "missing": m,
                "ratio": m / n if n else 0,
            }
        )
    return rows
