import pandas as pd
from typing import List, Dict

def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)

    col = "value"
    k = 10

    out = df.sort_values(col, ascending=False).head(k)

    rows = []
    for _, r in out.iterrows():
        rows.append(r.to_dict())
    return rows
