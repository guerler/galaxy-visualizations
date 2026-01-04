import DEFAULT_AGENT from "/polaris/agents/default.yml";

function toDict(payload: any) {
    return `json.loads(${JSON.stringify(JSON.stringify(payload))})`;
}

export async function runAgent(id: string, config: any, pyodide: any, transcripts: any) {
    const agent = DEFAULT_AGENT;
    const payload = {
        graph: agent,
        inputs: {
            transcripts,
        },
    };
    const raw = await pyodide.runPythonAsync([
        "import json",
        "from polaris import Registry, Runner",
        `payload = ${toDict(payload)}`,
        `config = ${toDict(config)}`,
        "registry = Registry(config)",
        "runner = Runner(payload['graph'], registry)",
        "result = await runner.run(payload['inputs'])",
        "json.dumps(result)",
    ]);
    if (typeof raw !== "string") {
        throw new Error("Polaris did not return JSON");
    }
    return JSON.parse(raw);
}
