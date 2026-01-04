import DEFAULT_AGENT from "@/agents/default.yml";

export async function runAgent(id: string, pyodide: any, transcripts: any) {
    const agent = DEFAULT_AGENT;

    return agent;
}

/*const analysis = PYTHON_ANALYSES[analysisId];
if (analysis) {
    const code = ["import json", analysis, `json.dumps(run("${datasetPath}"))`].join("\n");
    const raw = await pyodide.runPythonAsync(code);
    if (typeof raw === "string") {
        const result = JSON.parse(raw);
        if (Array.isArray(result)) {
            return result as Record<string, unknown>[];
        } else {
            throw new Error("Python analysis did not return array");
        }
    } else {
        throw new Error("Python analysis did not return JSON string");
    }
} else {
    throw new Error(`Unknown analysis: ${analysisId}`);
}*/
