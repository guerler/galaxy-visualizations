<script setup lang="ts">
import type { TranscriptMessageType, EmitUpdateType } from "galaxy-charts";
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
    AcademicCapIcon,
    ArrowPathIcon,
    CheckIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    SparklesIcon,
} from "@heroicons/vue/24/outline";
import type { ConsoleMessageType } from "@/types";
import Console from "@/components/Console.vue";
import Dashboard from "@/components/Dashboard.vue";

import { AgentRunner } from "@/modules/agent-runner";
import { ClientRegistry } from "./modules/client-registry";

import { PyodideManager } from "@/pyodide/pyodide-manager";
import { runAgent } from "./pyodide/pyodide-runner";

// Props
const props = defineProps<{
    datasetId: string;
    root: string;
    specs: {
        ai_api_base_url?: string;
        ai_api_key?: string;
        ai_max_tokens?: string;
        ai_model?: string;
        ai_prompt?: string;
        ai_temperature?: string;
        ai_top_p?: string;
        ai_contract?: any;
    };
    transcripts: TranscriptMessageType[];
}>();

// Emits
const emit = defineEmits<{
    (event: "update", config: EmitUpdateType): void;
}>();

// Constants
const MESSAGE_INITIAL = "Hi, I can a pick a tool for you.";
const MESSAGE_FAILED = "I failed to complete your request.";
const MESSAGE_SUCCESS = "Successfully produced output.";
const PROMPT_DEFAULT = "How can I help you?";
const PLUGIN_NAME = "orchestra";

// Load pyodide
const isDev = (import.meta as any).env.DEV;
const pyodideBaseUrl = isDev ? "" : `static/plugin/visualizations/${PLUGIN_NAME}/`;
const pyodide = new PyodideManager({
    indexURL: `${props.root}${pyodideBaseUrl}static/pyodide`,
    packages: ["polaris-0.0.0-py3-none-any.whl"],
});

// References
const consoleMessages = ref<ConsoleMessageType[]>([]);
const isProcessingRequest = ref<boolean>(false);
const isLoadingPyodide = ref<boolean>(true);

/*/ Create orchestra
const registry = new ClientRegistry({
    aiBaseUrl: props.specs.ai_api_base_url || `${props.root}api/ai/plugins/${PLUGIN_NAME}`,
    aiApiKey: props.specs.ai_api_key || "unknown",
    aiModel: props.specs.ai_model || "unknown",
});

const graph = yaml.parse(AGENT_YML);
if (!graph || typeof graph !== "object") {
    throw new Error("Invalid agent yml");
}

const agentRunner = new AgentRunner(graph, registry);
*/

// Inject Prompt
async function loadPrompt() {
    const transcripts = [...props.transcripts];
    if (transcripts.length === 0) {
        consoleMessages.value.push({ content: "Injected system prompt.", icon: SparklesIcon });
        transcripts.push({ content: systemPrompt(), role: "system" });
        consoleMessages.value.push({ content: "Injected assistant message.", icon: AcademicCapIcon });
        transcripts.push({ content: MESSAGE_INITIAL, role: "assistant" });
        emit("update", { transcripts });
    }
}

// Load Pyodide
async function loadPyodide() {
    if (isLoadingPyodide.value) {
        const pyodideMessageIndex = consoleMessages.value.length;
        consoleMessages.value.push({ content: "Loading Pyodide...", icon: ArrowPathIcon, spin: true });
        await pyodide.initialize();
        //datasetContent.value = await pyodide.fsFetch(datasetUrl, "dataset.csv");
        consoleMessages.value[pyodideMessageIndex] = { content: "Pyodide ready.", icon: CheckIcon };
        isLoadingPyodide.value = false;
        processUserRequest();
    }
}

// Get system prompt
function systemPrompt() {
    return `${props.specs?.ai_prompt || PROMPT_DEFAULT}`;
}

// Process user request
async function processUserRequest() {
    if (props.transcripts.length > 0 && !isLoadingPyodide.value) {
        const lastTranscript = props.transcripts[props.transcripts.length - 1];
        if (!isProcessingRequest.value && lastTranscript.role === "user") {
            isProcessingRequest.value = true;
            const transcripts = [...props.transcripts];
            try {
                transcripts.push({ content: MESSAGE_SUCCESS, role: "assistant", variant: "info" });
                emit("update", { transcripts });
                consoleMessages.value.push({ content: "Running agent graph...", icon: ClockIcon });
                const result = await runAgent("default", pyodide, transcripts);
                consoleMessages.value.push({ content: "Agent execution finished.", icon: SparklesIcon });
                console.log(result);
                /*if (result?.state?.output) {
                    consoleMessages.value.push({
                        content: JSON.stringify(result.state.output, null, 2),
                        icon: AcademicCapIcon,
                    });
                }*/
            } catch (e) {
                consoleMessages.value.push({ content: String(e), icon: ExclamationTriangleIcon });
                transcripts.push({ content: MESSAGE_FAILED, role: "assistant" });
                console.error(e);
            }
            emit("update", { transcripts });
            isProcessingRequest.value = false;
        }
    }
}

onMounted(() => {
    loadPrompt();
    loadPyodide();
});

onUnmounted(() => {});

watch(
    () => props.transcripts,
    () => processUserRequest(),
    { deep: true },
);
</script>

<template>
    <div class="flex flex-col h-screen p-2 bg-gray-700 text-white">
        <div class="flex-1 min-h-0">
            <Dashboard />
        </div>
        <Console class="shrink-0" :messages="consoleMessages" />
    </div>
</template>
