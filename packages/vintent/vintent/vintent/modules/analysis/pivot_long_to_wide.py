from typing import Dict, List

import pandas as pd


def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)

    id_col = "id"
    key_col = "key"
    val_col = "value"

    wide = df.pivot(index=id_col, columns=key_col, values=val_col).reset_index()

    rows = []
    for _, r in wide.iterrows():
        rows.append(r.where(pd.notnull(r), None).to_dict())
    return rows
