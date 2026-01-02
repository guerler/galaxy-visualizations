<script setup lang="ts">
import type { InputValuesType, TranscriptMessageType } from "galaxy-charts";
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
    AcademicCapIcon,
    ArrowPathIcon,
    CheckIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    SparklesIcon,
} from "@heroicons/vue/24/outline";
import { Orchestra } from "@/modules/orchestra";
import { PyodideManager } from "@/pyodide/pyodide-manager";
import Console from "@/components/Console.vue";
import Dashboard from "@/components/Dashboard.vue";
import Tabular from "@/components/Tabular.vue";
import type { ConsoleMessageType } from "@/types";

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
    (event: "update", newSettings: InputValuesType): void;
}>();

// Constants
const MESSAGE_INITIAL = "Hi, I will create plots for you.";
const MESSAGE_FAILED = "I failed to complete your request.";
const MESSAGE_SUCCESS = "I produced an output.";
const PROMPT_DATASET = "The content of 'dataset.csv' follows.";
const PROMPT_DEFAULT = "How can I help you?";
const PLUGIN_NAME = "orchestra";
const TEST_DATA = "test-data/dataset.csv";

// Dataset URL
const isTestData = props.datasetId === "__test__";
const datasetUrl = isTestData ? TEST_DATA : `${props.root}api/datasets/${props.datasetId}/display`;

// Load pyodide
const isDev = (import.meta as any).env.DEV;
const pyodideBaseUrl = isDev ? "" : `static/plugin/visualizations/${PLUGIN_NAME}/`;
const pyodide = new PyodideManager({ indexURL: `${props.root}${pyodideBaseUrl}static/pyodide` });

// References
const datasetContent = ref();
const consoleMessages = ref<ConsoleMessageType[]>([]);
const isLoadingPyodide = ref<boolean>(true);
const isProcessingRequest = ref<boolean>(false);
const widgets = ref<any>([]);

// Create orchestra
const orchestra = new Orchestra({
    aiBaseUrl: props.specs.ai_api_base_url || `${props.root}api/ai/plugins/${PLUGIN_NAME}`,
    aiApiKey: props.specs.ai_api_key || "unknown",
    aiModel: props.specs.ai_model || "unknown",
});

// Inject Prompt
async function loadPrompt() {
    const transcripts = [...props.transcripts];
    if (transcripts.length === 0) {
        consoleMessages.value.push({ content: "Injected system prompt.", icon: SparklesIcon });
        transcripts.push({ content: systemPrompt(), role: "system" });
        consoleMessages.value.push({ content: "Injected assistant message.", icon: AcademicCapIcon });
        transcripts.push({ content: MESSAGE_INITIAL, role: "assistant" });
        transcripts.push({ content: "create a correlation matrix", role: "user" });
        emit("update", { transcripts });
    }
}

// Load Pyodide
async function loadPyodide() {
    if (isLoadingPyodide.value) {
        const pyodideMessageIndex = consoleMessages.value.length;
        consoleMessages.value.push({ content: "Loading Pyodide...", icon: ArrowPathIcon, spin: true });
        await pyodide.initialize();
        datasetContent.value = await pyodide.fsFetch(datasetUrl, "dataset.csv");
        consoleMessages.value[pyodideMessageIndex] = { content: "Pyodide ready.", icon: CheckIcon };
        isLoadingPyodide.value = false;
        processUserRequest();
    }
}

// Get system prompt
function systemPrompt() {
    return `${props.specs?.ai_prompt || PROMPT_DEFAULT}\n\n${PROMPT_DATASET}\n${datasetContent.value}`;
}

// Process user request
async function processUserRequest() {
    if (props.transcripts.length > 0 && !isLoadingPyodide.value) {
        const lastTranscript = props.transcripts[props.transcripts.length - 1];
        if (!isProcessingRequest.value && lastTranscript.role == "user") {
            isProcessingRequest.value = true;
            const transcripts = [...props.transcripts];
            try {
                consoleMessages.value.push({ content: "Processing user request...", icon: ClockIcon });
                const newWidgets = await orchestra.process(transcripts, pyodide, datasetContent.value);
                if (newWidgets.length > 0) {
                    widgets.value.push(...newWidgets);
                    consoleMessages.value.push({ content: MESSAGE_SUCCESS, icon: CheckIcon });
                } else {
                    consoleMessages.value.push({ content: MESSAGE_FAILED, icon: ExclamationTriangleIcon });
                }
            } catch (e) {
                transcripts.push({ content: MESSAGE_FAILED, role: "assistant" });
                consoleMessages.value.push({ content: String(e), icon: ExclamationTriangleIcon });
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

onUnmounted(() => {
    pyodide.destroy();
});

watch(
    () => props.transcripts,
    () => processUserRequest(),
    { deep: true },
);
</script>

<template>
    <div class="flex flex-col h-screen p-2 bg-gray-700 text-white">
        <div class="flex-1 min-h-0">
            <Dashboard v-if="widgets.length > 0" :widgets="widgets" />
            <Tabular v-else-if="datasetContent" :csv="datasetContent" />
        </div>
        <Console class="shrink-0" :messages="consoleMessages" />
    </div>
</template>
