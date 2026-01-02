import pandas as pd
from typing import List, Dict

def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)
    num = df.select_dtypes(include="number")

    rows = []
    for c in num.columns:
        s = num[c]
        rows.append({
            "column": c,
            "mean": float(s.mean()),
            "median": float(s.median()),
            "std": float(s.std()),
            "min": float(s.min()),
            "max": float(s.max()),
        })
    return rows
