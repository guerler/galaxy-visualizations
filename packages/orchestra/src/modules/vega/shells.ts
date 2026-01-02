import type { ShellDefinition } from "./types";

export const shells: Record<string, ShellDefinition> = {
    bar_aggregate: {
        name: "Bar Diagram",
        family: "categorical_aggregate",
        signatures: [
            ["nominal", "quantitative"],
            ["ordinal", "quantitative"],
        ],
        mark: "bar",
        required: {
            x: { type: "nominal" },
            y: { type: "quantitative", aggregate: true },
        },
        optional: {
            color: { type: "nominal" },
            tooltip: "any",
        },
        constraints: {
            aggregateRequired: true,
        },
    },
    boxplot: {
        name: "Box Plot",
        family: "distribution",
        signatures: [
            ["nominal", "quantitative"],
            ["ordinal", "quantitative"],
        ],
        mark: "boxplot",
        required: {
            x: { type: "nominal" },
            y: { type: "quantitative" },
        },
        optional: {
            color: { type: "nominal" },
            tooltip: "any",
        },
    },
    density: {
        name: "Density Plot",
        family: "distribution",
        signatures: [["quantitative"]],
        mark: "area",
        required: {
            x: { type: "quantitative" },
        },
        optional: {
            color: { type: "nominal" },
            tooltip: "any",
        },
    },
    heatmap_correlation: {
        analysis: {
            language: "python",
            id: "correlation_matrix",
        },
        name: "Correlation Heatmap",
        family: "correlation_matrix",
        signatures: [["quantitative", "quantitative"]],
        mark: "rect",
        required: {},
        optional: {},
    },
    histogram: {
        name: "Histogram",
        family: "distribution",
        signatures: [["quantitative"]],
        mark: "bar",
        required: {
            x: { type: "quantitative", bin: true },
            y: { type: "quantitative", aggregate: "count" },
        },
        optional: {
            tooltip: "any",
        },
    },
    line_ordered: {
        name: "Line Chart",
        family: "trend",
        signatures: [
            ["ordinal", "quantitative"],
            ["quantitative", "quantitative"],
        ],
        mark: "line",
        required: {
            x: { type: "ordinal" },
            y: { type: "quantitative" },
        },
        optional: {
            color: { type: "nominal" },
            tooltip: "any",
        },
    },
    line_time: {
        name: "Trend Line",
        family: "trend",
        signatures: [["temporal", "quantitative"]],
        mark: "line",
        required: {
            x: { type: "temporal" },
            y: { type: "quantitative" },
        },
        optional: {
            color: { type: "nominal" },
            tooltip: "any",
        },
    },
    scatter: {
        name: "Scatter Plot",
        family: "correlation",
        signatures: [["quantitative", "quantitative"]],
        mark: "point",
        required: {
            x: { type: "quantitative" },
            y: { type: "quantitative" },
        },
        optional: {
            color: { type: "nominal" },
            tooltip: "any",
        },
    },
};
