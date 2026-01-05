from typing import Dict, List

import pandas as pd


def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)

    rows = []
    for c in df.columns:
        rows.append(
            {
                "column": c,
                "unique": int(df[c].nunique(dropna=True)),
            }
        )
    return rows
