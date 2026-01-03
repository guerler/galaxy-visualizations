import yaml from "yaml";
import Ajv from "ajv";
import { completionsPost, getToolCall } from "@/modules/ai/completions";
import { buildChooseShellTool, buildFillShellParamsTool } from "@/modules/tools";
import { shells } from "@/modules/shells";
import { profileCsv } from "@/modules/csv/profiler";
import { valuesFromCsv } from "@/modules/csv/values";
import { runAnalysis } from "@/pyodide/pyodide-runner";

import AGENT_YML from "@/agent.yml?raw";

export class Orchestra {
    private graph: any;
    private state: Record<string, any>;
    private aiConfig: { aiBaseUrl: string; aiApiKey: string; aiModel: string };

    constructor(aiConfig: { aiBaseUrl: string; aiApiKey: string; aiModel: string }) {
        this.aiConfig = aiConfig;
        this.graph = yaml.parse(AGENT_YML);
        this.state = {};
        this.validateGraph();
    }

    async run(transcripts: any[], pyodide: any, csvText: string) {
        transcripts.push({ content: "Working on it", role: "assistant", variant: "info" });
        this.state.inputs = { transcripts, pyodide, csvText };
        let nodeId = this.graph.start ?? "parse_dataset";

        if (nodeId) {
            while (nodeId) {
                const node = this.graph.nodes[nodeId];
                const result = await this.executeNode(node, transcripts, pyodide, csvText);
                nodeId = this.resolveNext(node, result);
            }
        }
        return this.state.vega_spec ? [this.state.vega_spec] : [];
    }

    private async executeNode(node: any, transcripts: any[], pyodide: any, csvText: string) {
        if (node.type === "planner") {
            return this.runPlanner(node, transcripts);
        } else if (node.type === "executor") {
            return this.runExecutor(node, pyodide, csvText);
        } else if (node.type === "control") {
            return this.runControl(node);
        } else if (node.type === "terminal") {
            return null;
        }
    }

    private runControl(node: any) {
        const condition = node.condition;
        let result = false;
        if (condition) {
            if (condition.shell_requires_analysis === true) {
                const shell = shells[this.state.shell_id];
                result = Boolean(shell?.analysis);
            }
        }
        return { result };
    }

    private async runPlanner(node: any, transcripts: any[]) {
        let output: any = null;
        let toolName: string | null = null;

        if (node && Array.isArray(node.tools)) {
            if (node.tools.includes("choose_shell")) {
                toolName = "choose_shell";
            } else if (node.tools.includes("fill_shell_params")) {
                toolName = "fill_shell_params";
            }
        }

        if (!toolName) {
            return null;
        }

        const tools = this.resolveTools(node);
        const reply = await completionsPost({
            ...this.aiConfig,
            messages: this.sanitizeTranscripts(transcripts),
            tools,
        });

        output = getToolCall(toolName, reply?.choices?.[0]?.message?.tool_calls);
        if (!output) {
            throw new Error(`Planner ${toolName} did not return a valid tool call`);
        }

        console.debug("[planner]", toolName, output);

        this.validatePlannerOutput(node.output_schema, output);
        this.applyEmit(node.emit, output);

        return output;
    }

    private async runExecutor(node: any, pyodide: any, csvText: string) {
        switch (node.run.op) {
            case "parse_csv": {
                const profile = profileCsv(csvText);
                const values = valuesFromCsv(csvText);
                this.state.profile = profile;
                this.state.values = values;
                return { ok: true };
            }
            case "validate_shell": {
                const shell = shells[this.state.shell_id];
                return shell.validate(this.state.params, this.state.profile);
            }
            case "run_python_analysis": {
                const shell = shells[this.state.shell_id];
                if (!shell?.analysis) {
                    throw new Error("run_python_analysis called on shell without analysis");
                }
                const values = await runAnalysis(pyodide, shell.analysis.id);
                this.state.effective_values = values;
                return { ok: true };
            }
            case "compile_vega": {
                const shell = shells[this.state.shell_id];
                const values = this.state.effective_values ?? this.state.values;
                this.state.vega_spec = shell.compile(this.state.params, values, "vega-lite");
                return { ok: true };
            }
            default:
                throw new Error(`Unknown executor op: ${node.run.op}`);
        }
    }

    private resolveNext(node: any, result: any) {
        if (node.type === "control") {
            return node.next[result.result === true ? "true" : "false"];
        }
        if (node.on) {
            if (result?.ok === true && node.on.ok) {
                return node.on.ok;
            }
            if (result?.ok === false && node.on.error) {
                return node.on.error;
            }
        }
        if (typeof node.next === "string") {
            return node.next;
        }
        return null;
    }

    private applyEmit(emit: any, output: any) {
        if (!emit || !output) {
            return;
        }
        for (const dest of Object.keys(emit)) {
            const src = emit[dest];
            const stateKey = dest.startsWith("state.") ? dest.slice("state.".length) : dest;

            if (src === "." || src === "$self") {
                this.state[stateKey] = output;
            } else {
                this.state[stateKey] = output[src];
            }
        }
    }

    private sanitizeTranscripts(transcripts: any[]) {
        return transcripts
            .filter((t) => typeof t.content === "string" && t.content.length > 0)
            .map((t) => ({ role: t.role, content: t.content }));
    }

    private resolveTools(node: any) {
        if (node.tools?.includes("choose_shell")) {
            return [buildChooseShellTool(this.state.profile)];
        }
        if (node.tools?.includes("fill_shell_params")) {
            const shellId = this.state.shell_id;
            if (!shellId || !shells[shellId]) {
                throw new Error("fill_shell_params called without a valid shell_id");
            }
            return [buildFillShellParamsTool(shells[shellId], this.state.profile)];
        }
        return [];
    }

    private validateGraph() {
        const ajv = new Ajv();
        // schema validation placeholder
    }

    private validatePlannerOutput(schema: any, output: any) {
        if (!schema) {
            return;
        }
        const ajv = new Ajv();
        const validate = ajv.compile(schema);
        if (!validate(output)) {
            throw new Error(`Planner output schema violation: ${ajv.errorsText(validate.errors)}`);
        }
    }
}
