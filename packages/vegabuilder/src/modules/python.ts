const PYTHON_ANALYSES: Record<string, string> = {
    correlation_matrix: `
import pandas as pd
import json

df = pd.read_csv("dataset.csv")
corr = df.select_dtypes(include="number").corr()

rows = []
for x in corr.columns:
    for y in corr.columns:
        rows.append({
            "x": x,
            "y": y,
            "value": float(corr.loc[x, y]),
        })

json.dumps(rows)
`,
};

export async function runShellAnalysis(pyodide: any, analysisId: string): Promise<Record<string, unknown>[]> {
    const code = PYTHON_ANALYSES[analysisId];
    if (!code) {
        throw new Error(`Unknown analysis: ${analysisId}`);
    }
    const result = await pyodide.runPythonAsync(code);
    if (typeof result !== "string") {
        throw new Error("Python analysis did not return JSON string");
    }
    return JSON.parse(result);
}
