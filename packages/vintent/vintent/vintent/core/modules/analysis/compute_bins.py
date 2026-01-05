from typing import Dict, List

import numpy as np
import pandas as pd


def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)

    col = "value"
    bins = 10

    values = df[col].dropna().to_numpy()
    hist, edges = np.histogram(values, bins=bins)

    rows = []
    for i in range(len(hist)):
        rows.append(
            {
                "bin_start": float(edges[i]),
                "bin_end": float(edges[i + 1]),
                "count": int(hist[i]),
            }
        )
    return rows
