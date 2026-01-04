import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import yaml from "@rollup/plugin-yaml";

import { viteConfigCharts } from "./vite.config.charts";

export default defineConfig({
    ...viteConfigCharts,
    plugins: [
        tailwindcss(),
        viteStaticCopy({
            targets: [
                {
                    src: "node_modules/pyodide/*",
                    dest: "pyodide",
                },
                {
                    src: "temp/pyodide/*",
                    dest: "pyodide",
                },
                {
                    src: "polaris/dist/polaris-*.whl",
                    dest: "pyodide",
                }
            ],
        }),
        vue(),
        yaml(),
    ],
    test: {
        environment: "happy-dom",
        globals: true,
        include: ["src/**/*.test.{js,ts,jsx,tsx}"],
    },
    worker: {
        format: "es",
    },
});
