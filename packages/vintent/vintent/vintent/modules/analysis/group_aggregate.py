from typing import Dict, List

import pandas as pd


def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)

    group_cols = ["group"]
    value_col = "value"
    agg = "mean"

    g = df.groupby(group_cols)[value_col].agg(agg).reset_index()

    rows = []
    for _, r in g.iterrows():
        row = {}
        for c in group_cols:
            row[c] = r[c]
        row[value_col] = float(r[value_col])
        rows.append(row)
    return rows
