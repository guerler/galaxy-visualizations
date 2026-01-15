<script setup lang="ts">
import type { TranscriptMessageType, EmitUpdateType } from "galaxy-charts";
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
    AcademicCapIcon,
    ArrowPathIcon,
    BoltIcon,
    CheckIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    SparklesIcon,
} from "@heroicons/vue/24/outline";
import type { ConsoleMessageType } from "@/types";
import Console from "@/components/Console.vue";
import Dashboard from "@/components/Dashboard.vue";

import { PyodideManager } from "@/pyodide/pyodide-manager";
import { runPolaris } from "./pyodide-runner";

// Props
const props = defineProps<{
    datasetId: string;
    root: string;
    settings: {
        agent: string;
    };
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
    (event: "update", state: EmitUpdateType): void;
}>();

// Constants
const MESSAGE_INITIAL = "Hi, I can a pick a tool for you.";
const MESSAGE_FAILED = "I failed to complete your request.";
const MESSAGE_SUCCESS = "Successfully produced output.";
const PROMPT_DEFAULT = "How can I help you?";
const PLUGIN_NAME = "polaris";

// Load pyodide
const isDev = (import.meta as any).env.DEV;
const pyodideBaseUrl = isDev ? "" : `static/plugins/visualizations/${PLUGIN_NAME}/`;
const pyodideIndexUrl = `${props.root}${pyodideBaseUrl}static/pyodide`;
const pyodide = new PyodideManager({
    indexURL: pyodideIndexUrl,
    extraPackages: [`${pyodideIndexUrl}/polaris-0.0.0-py3-none-any.whl`],
});

// References
const consoleMessages = ref<ConsoleMessageType[]>([]);
const isProcessingRequest = ref<boolean>(false);
const isLoadingPyodide = ref<boolean>(true);

// Configuration
function getConfig() {
    return {
        ai_base_url: props.specs.ai_api_base_url || `${props.root}api/plugins/${PLUGIN_NAME}`,
        ai_api_key: props.specs.ai_api_key,
        ai_model: props.specs.ai_model,
        galaxy_root: props.root,
    };
}

// Inject Prompt
async function loadPrompt() {
    const transcripts = [...props.transcripts];
    if (transcripts.length === 0) {
        consoleMessages.value.push({ content: "Injected system prompt.", icon: SparklesIcon });
        transcripts.push({ content: systemPrompt(), role: "system" });
        consoleMessages.value.push({ content: "Injected assistant message.", icon: AcademicCapIcon });
        transcripts.push({ content: MESSAGE_INITIAL, role: "assistant" });
        transcripts.push({ content: "Pick genetics.", role: "user" });
        emit("update", { transcripts });
    }
}

// Load Pyodide
async function loadPyodide() {
    if (isLoadingPyodide.value) {
        const pyodideMessageIndex = consoleMessages.value.length;
        consoleMessages.value.push({ content: "Loading Pyodide...", icon: ArrowPathIcon, spin: true });
        await pyodide.initialize();
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
                const agent = props.settings.agent;
                consoleMessages.value.push({ content: `Running ${agent} agent...`, icon: ClockIcon });
                const config = getConfig();
                const reply = await runPolaris(pyodide, config, [lastTranscript], agent);
                consoleMessages.value.push({ content: "Agent execution finished.", icon: BoltIcon });
                console.debug("[polaris]", reply);
                if (reply && reply.last && reply.last.result) {
                    consoleMessages.value.push({
                        content: JSON.stringify(reply.last.result, null, 2),
                        icon: AcademicCapIcon,
                    });
                }
                transcripts.push({ content: MESSAGE_SUCCESS, role: "assistant", variant: "info" });
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
    <div class="flex flex-col h-screen p-1">
        <div class="flex-1 min-h-0">
            <Dashboard />
        </div>
        <Console class="shrink-0 pt-1" :messages="consoleMessages" />
    </div>
</template>
