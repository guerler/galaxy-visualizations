import DEFAULT_AGENT from "@/agents/default.yml";

export async function runAgent(id: string, config: any, pyodide: any, transcripts: any) {
    const agent = DEFAULT_AGENT;

    const payload = {
        graph: agent,
        inputs: {
            transcripts,
        },
    };

    const code = [
        "import json",
        "from polaris import Registry, Runner",
        "",
        `payload = json.loads(${JSON.stringify(JSON.stringify(payload))})`,
        `config = json.loads(${JSON.stringify(JSON.stringify(config))})`,
        "",
        "registry = Registry(config)",
        "runner = Runner(payload['graph'], registry)",
        "result = await runner.run(payload['inputs'])",
        "",
        "json.dumps(result)",
    ].join("\n");

    const raw = await pyodide.runPythonAsync(code);

    if (typeof raw !== "string") {
        throw new Error("Polaris did not return JSON");
    }

    return JSON.parse(raw);
}

