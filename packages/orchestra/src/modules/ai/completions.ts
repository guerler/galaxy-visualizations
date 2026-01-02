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
}

export type CompletionsReply = any;

export type CompletionsRole = "assistant" | "system" | "user";

const MAX_TOKENS = 16384;
const TEMPERATURE = 0.3;
const TOP_P = 0.8;

export async function completionsPost(payload: CompletionsPayload): Promise<CompletionsReply> {
    const baseUrl = payload.aiBaseUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/chat/completions`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${payload.aiApiKey}` },
        body: JSON.stringify({
            model: payload.aiModel,
            messages: payload.messages,
            max_tokens: normalizeParameter(payload.aiMaxTokens, 1, Infinity, MAX_TOKENS),
            temperature: normalizeParameter(payload.aiTemperature, 0, Infinity, TEMPERATURE),
            top_p: normalizeParameter(payload.aiTopP, Number.EPSILON, 1, TOP_P),
            tools: payload.tools,
            tool_choice: "auto",
        }),
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
