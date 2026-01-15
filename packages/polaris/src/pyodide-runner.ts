import HISTORY_EXPLORER from "/polaris/agents/history_explorer.yml";
import REPORT_GENERATOR from "/polaris/agents/report_generator.yml";

const AGENTS = {
    history_explorer: HISTORY_EXPLORER,
    report_generator: REPORT_GENERATOR,
};

function toDict(payload: any) {
    return `json.loads(${JSON.stringify(JSON.stringify(payload))})`;
}

export async function runPolaris(pyodide: any, config: any, transcripts: any, name: string) {
    const agents = AGENTS;
    const inputs = { transcripts };
    const raw = await pyodide.runPythonAsync([
        "import json",
        "from polaris import run",
        `agents = ${toDict(agents)}`,
        `config = ${toDict(config)}`,
        `inputs = ${toDict(inputs)}`,
        `name = ${JSON.stringify(name)}`,
        "result = await run(config, inputs, name, agents)",
        "json.dumps(result)",
    ]);
    if (typeof raw !== "string") {
        throw new Error("Polaris did not return JSON");
    }
    return JSON.parse(raw);
}
