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
    async plan(ctx: ExecContext, spec: { prompt?: string; node: any; tools: any[]; outputSchema: any }) {
        const systemPrompt =
            spec.prompt || "You are a routing component. You MUST call the provided tool. Do not respond with text.";
        const messages = [{ role: "system", content: systemPrompt }, ...this.sanitize(ctx.inputs.transcripts as any[])];
        const tools = this.buildRouteTool(ctx, spec.node, spec.outputSchema);
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

    private buildRouteTool(ctx: ExecContext, node: any, outputSchema?: any) {
        let nextEnum: string[];
        if (
            outputSchema &&
            outputSchema.properties &&
            outputSchema.properties.next &&
            Array.isArray(outputSchema.properties.next.enum)
        ) {
            nextEnum = outputSchema.properties.next.enum;
        } else {
            nextEnum = Object.keys(ctx.graph.nodes);
        }
        const properties: any = {
            next: {
                type: "string",
                enum: nextEnum,
            },
        };
        const required = new Set<string>(["next"]);
        if (node.enum_from && outputSchema && Array.isArray(outputSchema.required)) {
            const src = ctx.state[node.enum_from.state];
            if (!Array.isArray(src)) {
                throw new Error(`enum_from source is not an array: ${node.enum_from.state}`);
            }
            let values = src;
            if (node.enum_from.filter) {
                values = values.filter((v: any) => v?.[node.enum_from.filter.field] === node.enum_from.filter.equals);
            }
            const enumValues = values
                .map((v: any) => v?.[node.enum_from.field])
                .filter((v: any) => typeof v === "string");
            const field = outputSchema.required.find((k: string) => k !== "next");
            if (field) {
                properties[field] = {
                    type: "string",
                    enum: enumValues,
                };
                required.add(field);
            }
        }
        return [
            {
                type: "function",
                function: {
                    name: "route",
                    description: "Select the next node and required identifiers.",
                    parameters: {
                        type: "object",
                        required: Array.from(required),
                        properties,
                        additionalProperties: false,
                    },
                },
            },
        ];
    }
}
