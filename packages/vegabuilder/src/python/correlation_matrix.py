import pandas as pd
from typing import List, Dict

def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)
    corr = df.select_dtypes(include="number").corr()

    rows = []
    for x in corr.columns:
        for y in corr.columns:
            rows.append({
                "x": x,
                "y": y,
                "value": float(corr.loc[x, y]),
            })
    return rows
