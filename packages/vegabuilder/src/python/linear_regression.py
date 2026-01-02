import pandas as pd
from typing import List, Dict

def run(dataset_path: str) -> List[Dict[str, object]]:
    df = pd.read_csv(dataset_path)

    xcol = "x"
    ycol = "y"

    x = df[xcol]
    y = df[ycol]
    mask = x.notna() & y.notna()
    x = x[mask]
    y = y[mask]

    xm = x.mean()
    ym = y.mean()
    den = ((x - xm) ** 2).sum()
    slope = ((x - xm) * (y - ym)).sum() / den if den != 0 else 0
    intercept = ym - slope * xm

    yhat = slope * x + intercept
    ss_res = ((y - yhat) ** 2).sum()
    ss_tot = ((y - ym) ** 2).sum()
    r2 = 1 - ss_res / ss_tot if ss_tot != 0 else 0

    rows = []
    for xi, yi in zip(x, yhat):
        rows.append({
            "x": float(xi),
            "yhat": float(yi),
        })

    rows.append({
        "slope": float(slope),
        "intercept": float(intercept),
        "r2": float(r2),
    })
    return rows
