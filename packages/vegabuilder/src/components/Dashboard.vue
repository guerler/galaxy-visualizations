<script setup lang="ts">
import { computed } from "vue";
import Vega from "@/components/Vega.vue";

const props = defineProps<{
    widgets: Array<any>;
}>();

const count = computed(() => props.widgets.length);

const columns = computed(() => {
    if (count.value === 0) {
        return 1;
    } else {
        return Math.ceil(Math.sqrt(count.value));
    }
});

const grid = computed(() => {
    return {
        display: "grid",
        gridTemplateColumns: `repeat(${columns.value}, minmax(0, 1fr))`,
        gridAutoRows: "minmax(0, 1fr)",
        gap: "0.5rem",
    };
});

function parse(widget: any) {
    try {
        const json = JSON.parse(widget);
        return json;
    } catch (e) {
        return widget;
    }
}
</script>
<template>
    <div class="h-full" :style="grid">
        <div
            v-for="(widget, widgetIndex) in props.widgets"
            :key="widgetIndex"
            class="flex flex-col min-h-0 bg-white border border-gray-200 p-1 rounded text-gray-800 text-sm">
            <Vega class="flex-1 min-h-0 overflow-hidden" :spec="parse(widget)" />
        </div>
    </div>
</template>
