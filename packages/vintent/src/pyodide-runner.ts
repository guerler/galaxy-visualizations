function toDict(payload: any) {
    return `json.loads(${JSON.stringify(JSON.stringify(payload))})`;
}

export async function vintentRun(config: any, pyodide: any, transcripts: any) {
    const inputs = { transcripts };
    const raw = await pyodide.runPythonAsync([
        "import json",
        "from vintent import run",
        `inputs = ${toDict(inputs)}`,
        `config = ${toDict(config)}`,
        "result = await run('./dataset.csv', inputs, config)",
        "json.dumps(result)",
    ]);
    if (typeof raw !== "string") {
        throw new Error("Did not return JSON.");
    }
    return JSON.parse(raw);
}
