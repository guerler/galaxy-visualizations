import { completionsPost, getToolCall, type CompletionsReply, type CompletionsMessage } from "@/modules/ai/completions";
import { type TranscriptMessageType, TRANSCRIPT_VARIANT } from "galaxy-charts";
import type { ConsoleMessageType } from "@/types";

import { buildChooseShellTool, buildFillShellParamsTool } from "@/modules/tools";
import { shells } from "@/modules/vega/shells";
import { validateShellParams } from "@/modules/vega/validator";
import { compileVegaLite } from "@/modules/vega/compiler";
import { profileCsv } from "@/modules/csv/profiler";
import { valuesFromCsv } from "@/modules/csv/values";
import { runShellAnalysis } from "@/modules/python";

export class Orchestra {
    private aiBaseUrl: string;
    private aiApiKey: string;
    private aiModel: string;

    constructor({ aiBaseUrl, aiApiKey, aiModel }: { aiBaseUrl: string; aiApiKey: string; aiModel: string }) {
        this.aiBaseUrl = aiBaseUrl;
        this.aiApiKey = aiApiKey;
        this.aiModel = aiModel;
    }

    async process(transcripts: TranscriptMessageType[], pyodide: any, csvText: string): Promise<any[]> {
        const msgs: ConsoleMessageType[] = [];
        const wdgs: any[] = [];

        const profile = profileCsv(csvText);
        const values = valuesFromCsv(csvText);

        // STEP 1: Choose shell
        const chooseReply = await this.completions(transcripts, [buildChooseShellTool()]);
        if (!chooseReply) {
            throw "No response from AI provider";
        }
        const chooseShell = getToolCall("choose_shell", chooseReply.choices?.[0]?.message?.tool_calls);
        if (!chooseShell?.shellId) {
            throw "LLM did not select a visualization shell";
        }
        if (!(chooseShell.shellId in shells)) {
            throw `Unknown shell selected: ${chooseShell.shellId}`;
        }
        const shell = shells[chooseShell.shellId];
        transcripts.push({
            role: "assistant",
            content: `I will plot a ${shell.name}.`,
            variant: TRANSCRIPT_VARIANT.INFO,
        });
        transcripts.push({
            role: "assistant",
            content: `Calling choose_shell_tool with: ${chooseShell.shellId}`,
            variant: TRANSCRIPT_VARIANT.DATA,
        });

        // STEP 2: Fill parameters
        const paramReply = await this.completions(transcripts, [buildFillShellParamsTool(shell, profile)]);
        if (!paramReply) {
            throw "No response when filling shell parameters";
        }
        const params = getToolCall("fill_shell_params", paramReply.choices?.[0]?.message?.tool_calls);
        if (!params) {
            throw "LLM did not provide shell parameters";
        }
        transcripts.push({
            role: "assistant",
            content: `I created the plot for you.`,
            variant: TRANSCRIPT_VARIANT.INFO,
        });
        transcripts.push({
            role: "assistant",
            content: `Calling fill_shell_params with: ${JSON.stringify(params)}}`,
            variant: TRANSCRIPT_VARIANT.DATA,
        });

        // Validate
        const effectiveParams = { ...params };
        for (const [encoding, spec] of Object.entries(shell.required || {})) {
            if (isEncodingSpec(spec) && typeof spec.aggregate === "string") {
                effectiveParams[encoding] = {
                    field: null,
                    aggregate: spec.aggregate,
                };
            }
        }
        const validation = validateShellParams(shell, effectiveParams, profile);
        if (!validation.ok) {
            throw "Invalid visualization parameters";
        }
        for (const w of validation.warnings) {
            msgs.push({ type: "warning", content: w.code, details: w.details });
        }

        // Run python code
        let effectiveValues = values;
        if (shell.analysis?.language === "python") {
            effectiveValues = await runShellAnalysis(pyodide, shell.analysis.id);
            console.log(effectiveValues);
        }
        // Create vega spec
        const vegaSpec = compileVegaLite(shell, effectiveParams, effectiveValues);
        wdgs.push(vegaSpec);
        return wdgs;
    }

    private async completions(transcripts: TranscriptMessageType[], tools: any[]): Promise<CompletionsReply | null> {
        return completionsPost({
            aiBaseUrl: this.aiBaseUrl,
            aiApiKey: this.aiApiKey,
            aiModel: this.aiModel,
            messages: sanitizeTranscripts(transcripts),
            tools,
        });
    }
}

// utilities
function isEncodingSpec(spec: unknown): spec is { type: string; aggregate?: boolean; bin?: boolean } {
    return typeof spec === "object" && spec !== null && "type" in spec && typeof (spec as any).type === "string";
}

function sanitizeTranscripts(transcripts: TranscriptMessageType[]): CompletionsMessage[] {
    return transcripts
        .filter(
            (t) =>
                typeof t.content === "string" &&
                t.content.length > 0 &&
                (!t.variant || t.variant === TRANSCRIPT_VARIANT.DATA),
        )
        .map((t) => ({ role: t.role, content: t.content })) as CompletionsMessage[];
}
