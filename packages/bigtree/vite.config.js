import { defineConfig } from "vite";

import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

import { viteConfigCharts } from "./vite.config.charts.js";

export default defineConfig({
    ...viteConfigCharts,
    plugins: [vue(), tailwindcss()],
});
