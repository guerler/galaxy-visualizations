<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from "vue";

type Role = "user" | "assistant" | "system";

interface Message {
    id: number;
    role: Role;
    content: string;
}

const props = defineProps<{
    datasetId: string;
    datasetUrl: string;
    root: string;
    specs: {
        ai_api_base_url: string;
        ai_api_key: string;
        ai_model: string;
        ai_temperature: number;
    };
}>();

const viewport = ref<HTMLElement | null>(null);
const input = ref("");
const messages = ref<Message[]>([
    {
        id: 0,
        role: "system",
        content: "Dataset loaded. You can start your analysis.",
    },
]);

let nextId = 1;

async function send() {
    const text = input.value.trim();
    if (!text) {
        return;
    }

    messages.value.push({
        id: nextId++,
        role: "user",
        content: text,
    });

    input.value = "";

    const assistantId = nextId++;
    messages.value.push({
        id: assistantId,
        role: "assistant",
        content: "Thinking…",
    });

    nextTick(scrollToBottom);

    try {
        const response = await fetch(`${props.specs.ai_api_base_url}chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${props.specs.ai_api_key}`,
            },
            body: JSON.stringify({
                model: props.specs.ai_model,
                messages: messages.value.map(({ role, content }) => ({
                    role,
                    content,
                })),
                temperature: props.specs.ai_temperature,
            }),
        });

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;

        const msg = messages.value.find((m) => m.id === assistantId);
        if (msg) {
            msg.content = reply || "No response.";
        }
    } catch (e) {
        const msg = messages.value.find((m) => m.id === assistantId);
        if (msg) {
            msg.content = "Error contacting AI service.";
        }
    }

    nextTick(scrollToBottom);
}

function scrollToBottom() {
    if (viewport.value) {
        viewport.value.scrollTop = viewport.value.scrollHeight;
    }
}

async function render() {}

onMounted(() => {
    render();
});

watch(
    () => props,
    () => render(),
    { deep: true },
);
</script>

<template>
    <div class="flex flex-col h-screen bg-gray-900 text-white">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div class="font-semibold text-lg">ChatAnalysis</div>
            <div class="text-sm text-gray-400 truncate">Dataset: {{ props.datasetId }}</div>
        </div>

        <!-- Messages -->
        <div ref="viewport" class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div
                v-for="msg in messages"
                :key="msg.id"
                class="flex"
                :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
                <div
                    class="max-w-[75%] px-4 py-2 rounded-lg whitespace-pre-wrap"
                    :class="{
                        'bg-blue-600 text-white': msg.role === 'user',
                        'bg-gray-800 text-gray-100': msg.role === 'assistant',
                        'bg-gray-700 text-gray-300 text-sm italic': msg.role === 'system',
                    }">
                    {{ msg.content }}
                </div>
            </div>
        </div>

        <!-- Input -->
        <div class="border-t border-gray-700 px-4 py-3">
            <form class="flex items-center gap-2" @submit.prevent="send">
                <input
                    v-model="input"
                    type="text"
                    placeholder="Ask a question about the dataset…"
                    class="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-md px-3 py-2 focus:outline-none focus:ring focus:ring-blue-600" />
                <button
                    type="submit"
                    class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md disabled:opacity-50">
                    Send
                </button>
            </form>
        </div>
    </div>
</template>
