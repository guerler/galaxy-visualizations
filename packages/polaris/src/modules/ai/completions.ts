export interface CompletionsMessage {
    role: CompletionsRole;
    content: string;
}

export interface CompletionsPayload {
    aiApiKey: string;
    aiBaseUrl: string;
    aiMaxTokens?: number;
    aiModel: string;
    aiTemperature?: number;
    aiTopP?: number;
    messages: CompletionsMessage[];
    tools?: object[];
    tool_choice?: object;
}

export type CompletionsReply = any;

export type CompletionsRole = "assistant" | "system" | "user";

const MAX_TOKENS = 16384;
const TEMPERATURE = 0.3;
const TOP_P = 0.8;

export async function completionsPost(payload: CompletionsPayload): Promise<CompletionsReply> {
    const baseUrl = payload.aiBaseUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/chat/completions`;
    const body: any = {
        model: payload.aiModel,
        messages: payload.messages,
        max_tokens: normalizeParameter(payload.aiMaxTokens, 1, Infinity, MAX_TOKENS),
        temperature: normalizeParameter(payload.aiTemperature, 0, Infinity, TEMPERATURE),
        top_p: normalizeParameter(payload.aiTopP, Number.EPSILON, 1, TOP_P),
    };
    if (payload.tools && payload.tools.length > 0) {
        body.tools = payload.tools;
    }
    if (payload.tool_choice) {
        body.tool_choice = payload.tool_choice;
    } else if (payload.tools && payload.tools.length > 0) {
        const firstTool = payload.tools[0] as any;
        const toolName = firstTool?.function?.name;
        if (!toolName) {
            throw new Error("Tool provided without function name");
        }
        body.tool_choice = {
            type: "function",
            function: { name: toolName },
        };
    }
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${payload.aiApiKey}`,
        },
        body: JSON.stringify(body),
    });
    return await response.json();
}

export function getToolCall(name: string, toolCalls: Array<any>): Record<string, any> | undefined {
    let result: Record<string, any> = {};
    let found = false;
    if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
            if (call?.function?.name === name) {
                found = true;
                const args = call.function.arguments;
                if (typeof args === "string" && args.length > 0) {
                    try {
                        const parsed = JSON.parse(args);
                        result = { ...result, ...parsed };
                    } catch {
                        continue;
                    }
                }
            }
        }
    }
    return found ? result : undefined;
}

function normalizeParameter(v: number | undefined, min: number, max: number, fallback: number) {
    if (v == null) {
        return fallback;
    } else {
        if (v < min) {
            return min;
        } else {
            if (v > max) {
                return max;
            } else {
                return v;
            }
        }
    }
}
