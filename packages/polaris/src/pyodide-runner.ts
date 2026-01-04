import DEFAULT_AGENT from "/polaris/agents/default.yml";

function toDict(payload: any) {
    return `json.loads(${JSON.stringify(JSON.stringify(payload))})`;
}

export async function polarisRun(id: string, config: any, pyodide: any, transcripts: any) {
    const agent = DEFAULT_AGENT;
    const inputs = { transcripts };
    const raw = await pyodide.runPythonAsync([
        "import json",
        "from polaris import run",
        `agent = ${toDict(agent)}`,
        `inputs = ${toDict(inputs)}`,
        `config = ${toDict(config)}`,
        "result = await run(agent, inputs, config)",
        "json.dumps(result)",
    ]);
    if (typeof raw !== "string") {
        throw new Error("Polaris did not return JSON");
    }
    return JSON.parse(raw);
}
