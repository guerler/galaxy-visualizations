import { completionsPost, getToolCall, type CompletionsReply, type CompletionsMessage } from "@/modules/ai/completions";
import { type TranscriptMessageType, TRANSCRIPT_VARIANT } from "galaxy-charts";

import { buildChooseShellTool, buildFillShellParamsTool } from "@/modules/tools";
import { shells } from "@/modules/shells";
import { profileCsv } from "@/modules/csv/profiler";
import { valuesFromCsv } from "@/modules/csv/values";
import { runAnalysis } from "@/pyodide/pyodide-runner";

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
        const wdgs: any[] = [];

        // Parse dataset
        const profile = profileCsv(csvText);
        const values = valuesFromCsv(csvText);

        // STEP 1: Choose shell
        const chooseReply = await this.completions(transcripts, [buildChooseShellTool(profile)]);
        if (chooseReply) {
            const chooseShell = getToolCall("choose_shell", chooseReply.choices?.[0]?.message?.tool_calls);
            if (chooseShell?.shellId) {
                const shell = shells[chooseShell.shellId];
                if (shell) {
                    // Log intent
                    transcripts.push({
                        role: "assistant",
                        content: `I will produce a ${shell.name}.`,
                        variant: TRANSCRIPT_VARIANT.INFO,
                    });
                    transcripts.push({
                        role: "assistant",
                        content: `Calling choose_shell_tool with: ${chooseShell.shellId}`,
                        variant: TRANSCRIPT_VARIANT.DATA,
                    });
                    // STEP 2: Fill parameters
                    let params: Record<string, any> = {};
                    const paramReply = await this.completions(transcripts, [buildFillShellParamsTool(shell, profile)]);
                    if (paramReply) {
                        const filled = getToolCall("fill_shell_params", paramReply.choices?.[0]?.message?.tool_calls);
                        if (filled) {
                            params = { ...params, ...filled };
                        }
                        // STEP 3: Shell validation
                        const validation = shell.validate(params, profile);
                        if (validation.ok) {
                            for (const w of validation.warnings) {
                                console.debug("[orchestra]", w.code, w.details);
                            }
                            // STEP 4: Analysis (if shell requires it)
                            let effectiveValues = values;
                            if (shell.analysis?.language === "python") {
                                effectiveValues = await runAnalysis(pyodide, shell.analysis.id);
                                console.debug("[orchestra]", effectiveValues);
                            }
                            // STEP 5: Compile via shell
                            const spec = shell.compile(params, effectiveValues, "vega-lite");
                            wdgs.push(spec);
                            return wdgs;
                        } else {
                            console.debug("[orchestra]", params, validation);
                            throw "Invalid visualization parameters";
                        }
                    } else {
                        throw "No response when filling shell parameters";
                    }
                } else {
                    throw `Unknown shell selected: ${chooseShell.shellId}`;
                }
            } else {
                throw "LLM did not select a visualization shell";
            }
        } else {
            throw "No response from AI provider";
        }
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
