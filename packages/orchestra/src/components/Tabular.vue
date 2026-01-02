<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
    defineProps<{
        csv: string;
        maxRows?: number;
    }>(),
    {
        maxRows: 0,
    },
);

function parseCSV(text: string) {
    const lines = text.trim().split(/\r?\n/);
    return lines.map((line) => line.split(","));
}

const rows = computed(() => {
    if (props.csv) {
        const parsed = parseCSV(props.csv);
        if (props.maxRows > 0 && parsed.length > props.maxRows + 1) {
            return [parsed[0], ...parsed.slice(1, props.maxRows + 1)];
        } else {
            return parsed;
        }
    } else {
        return [];
    }
});

const header = computed(() => (rows.value.length > 0 ? rows.value[0] : []));
const body = computed(() => (rows.value.length > 1 ? rows.value.slice(1) : []));
</script>

<template>
    <div class="h-full overflow-auto">
        <table class="min-w-full border-collapse text-sm">
            <thead class="bg-gray-100">
                <tr>
                    <th class="tabular-header">#</th>
                    <th v-for="(cell, i) in header" :key="i" class="tabular-header">
                        {{ cell }}
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(row, r) in body" :key="r" class="odd:bg-white even:bg-gray-50">
                    <td class="tabular-row">
                        {{ r + 1 }}
                    </td>
                    <td v-for="(cell, c) in row" :key="c" class="tabular-row">
                        {{ cell }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
