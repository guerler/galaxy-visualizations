import DEFAULT_AGENT from "/polaris/agents/default.yml";

const AGENTS = {
    default: DEFAULT_AGENT,
};

function toDict(payload: any) {
    return `json.loads(${JSON.stringify(JSON.stringify(payload))})`;
}

export async function polarisRun(name: string, config: any, pyodide: any, transcripts: any) {
    const agents = AGENTS;
    const inputs = { transcripts };
    const raw = await pyodide.runPythonAsync([
        "import json",
        "from polaris import run",
        `name = ${JSON.stringify(name)}`,
        `agents = ${toDict(agents)}`,
        `inputs = ${toDict(inputs)}`,
        `config = ${toDict(config)}`,
        "result = await run(name, agents, inputs, config)",
        "json.dumps(result)",
    ]);
    if (typeof raw !== "string") {
        throw new Error("Polaris did not return JSON");
    }
    return JSON.parse(raw);
}
