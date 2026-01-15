<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";

const props = defineProps<{
    content: string;
}>();

const md = new MarkdownIt();

const renderedHtml = computed(() => {
    if (!props.content) {
        return "";
    }
    return md.render(props.content);
});
</script>

<template>
    <div class="h-full p-4">
        <div v-if="content" class="prose prose-sm max-w-none" v-html="renderedHtml" />
        <div v-else class="text-gray-500 text-center pt-8">Polaris Agent Runner</div>
    </div>
</template>
