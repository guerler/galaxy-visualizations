<script setup>
import { onMounted, ref } from "vue";

const TEST_DATA_FILE = "test-data/1.newick";

const props = defineProps({
    datasetId: String,
    datasetUrl: String,
    root: String,
    settings: Object,
    specs: Object,
    tracks: Array,
});

const viewerUrl = import.meta.env.DEV
    ? new URL("/viewer/index.html", window.location.href)
    : new URL(/* @vite-ignore */ "viewer/index.html", import.meta.url);
viewerUrl.searchParams.set("btv_api", "1");

const viewer = ref(null);
const errorMessage = ref("");
const statusMessage = ref("Loading dataset…");

let newick = "";

async function fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
}

function waitForViewer() {
    return new Promise((resolve) => {
        window.addEventListener("message", (event) => {
            if (event.source === viewer.value?.contentWindow && event.data?.type === "big-tree-viewer:ready") {
                resolve();
            }
        });
        viewer.value.src = viewerUrl.href;
    });
}

function render() {
    statusMessage.value = "Drawing tree…";
    viewer.value.contentWindow.postMessage(
        { type: "big-tree-viewer:load", payload: { newick, label: "Galaxy dataset" } },
        viewerUrl.origin,
    );
}

window.addEventListener("message", (event) => {
    if (event.source !== viewer.value?.contentWindow) {
        return;
    }
    if (event.data?.type === "big-tree-viewer:loaded") {
        statusMessage.value = "";
    } else if (event.data?.type === "big-tree-viewer:error") {
        errorMessage.value = `Could not display tree: ${event.data.message}`;
        statusMessage.value = "";
    }
});

onMounted(async () => {
    if (!props.datasetId) {
        errorMessage.value = "No dataset_id provided by Galaxy.";
        statusMessage.value = "";
        return;
    }
    try {
        const url = props.datasetId === "__test__" ? TEST_DATA_FILE : props.datasetUrl;
        [newick] = await Promise.all([fetchText(url), waitForViewer()]);
    } catch (err) {
        errorMessage.value = `Could not fetch dataset: ${err.message}`;
        statusMessage.value = "";
        return;
    }
    render();
});
</script>

<template>
    <div class="flex flex-col h-screen">
        <div
            v-if="errorMessage"
            id="bt-error"
            class="px-4 py-3 text-sm bg-red-100 text-red-900 border-b border-red-200">
            {{ errorMessage }}
        </div>
        <div v-if="statusMessage" id="bt-status" class="p-4 text-center text-sm text-gray-500">
            {{ statusMessage }}
        </div>
        <iframe id="bt-viewer" ref="viewer" title="Big Tree Viewer" class="flex-1 min-h-0 w-full border-0" />
    </div>
</template>
