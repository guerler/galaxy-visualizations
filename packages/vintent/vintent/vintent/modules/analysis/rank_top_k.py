from typing import Dict, List

import pandas as pd


def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)

    col = "value"
    k = 10

    out = df.sort_values(col, ascending=False).head(k)

    rows = []
    for _, r in out.iterrows():
        rows.append(r.to_dict())
    return rows
