import Ajv from "ajv";
import { completionsPost, getToolCall } from "@/modules/ai/completions";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

type ExecContext = {
    inputs: Record<string, Json>;
    state: Record<string, Json>;
    nodeId: string;
    graphId: string;
    graph: any;
};

type ApiCallSpec = {
    target: string;
    input?: Json;
};

type OpResult = { ok: true; result: Json } | { ok: false; error: { code: string; message: string } };

export class ClientRegistry {
    private aiConfig: { aiBaseUrl: string; aiApiKey: string; aiModel: string };
    private ajv: Ajv;
    private apiTargets: Record<string, (input: any) => Promise<any>>;
    readonly capabilities: string[];
    constructor(aiConfig: { aiBaseUrl: string; aiApiKey: string; aiModel: string }) {
        this.aiConfig = aiConfig;
        this.ajv = new Ajv();
        this.capabilities = ["llm", "galaxy.read"];
        this.apiTargets = {
            "galaxy.history.list": async (input) => {
                const params = new URLSearchParams();
                if (input?.limit) {
                    params.set("limit", String(input.limit));
                }
                const res = await fetch(`/api/histories?${params.toString()}`, { credentials: "same-origin" });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                return await res.json();
            },
            "galaxy.history.contents": async (input) => {
                const res = await fetch(`/api/histories/${input.history_id}/contents`, { credentials: "same-origin" });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                return await res.json();
            },
            "galaxy.dataset.show": async (input) => {
                const id = input?.dataset_id;
                if (!id) {
                    throw new Error("dataset_id missing");
                }
                const res = await fetch(`/api/datasets/${id}`, { credentials: "same-origin" });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                return await res.json();
            },
        };
    }
    async plan(ctx: ExecContext, spec: { tools: any[]; outputSchema: any }) {
        const messages = [
            {
                role: "system",
                content:
                    "You are a routing component.\n" +
                    "You MUST call the provided tool.\n" +
                    'The field `next` MUST be exactly the string "api_1".\n' +
                    "No other value is allowed.\n" +
                    "Do not respond with text.",
            },
            ...this.sanitize(ctx.inputs.transcripts as any[]),
        ];

        const tools = this.buildRouteTool(ctx.graph);
        const toolName = tools[0].function.name;

        const reply = await completionsPost({
            ...this.aiConfig,
            messages,
            tools,
            tool_choice: {
                type: "function",
                function: { name: toolName },
            },
        });

        const call = getToolCall(toolName, reply?.choices?.[0]?.message?.tool_calls);
        if (!call) {
            throw new Error("planner did not produce tool call");
        }

        if (spec.outputSchema) {
            const validate = this.ajv.compile(spec.outputSchema);
            if (!validate(call)) {
                throw new Error(`planner output schema violation: ${this.ajv.errorsText(validate.errors)}`);
            }
        }

        return call;
    }

    async callApi(ctx: ExecContext, spec: ApiCallSpec): Promise<OpResult> {
        const fn = this.apiTargets[spec.target];
        if (!fn) {
            return { ok: false, error: { code: "unknown_api_target", message: spec.target } };
        }
        try {
            const result = await fn(spec.input ?? {});
            return { ok: true, result };
        } catch (e: any) {
            return {
                ok: false,
                error: { code: "api_call_failed", message: String(e?.message ?? e) },
            };
        }
    }
    private sanitize(transcripts: any[]) {
        if (!Array.isArray(transcripts)) {
            return [];
        }
        return transcripts
            .filter((t) => typeof t?.content === "string" && t.content.length > 0)
            .map((t) => ({ role: t.role, content: t.content }));
    }

    private buildRouteTool(graph: any) {
        const nodeIds = Object.keys(graph.nodes);
        return [
            {
                type: "function",
                function: {
                    name: "route",
                    description: "Select the next node to execute",
                    parameters: {
                        type: "object",
                        required: ["next"],
                        properties: {
                            next: {
                                type: "string",
                                enum: nodeIds,
                            },
                        },
                    },
                },
            },
        ];
    }
}
