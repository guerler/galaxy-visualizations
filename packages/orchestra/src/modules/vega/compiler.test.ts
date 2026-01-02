import { describe, it, expect } from "vitest";
import { compileVegaLite } from "./compiler";
import { ShellDefinition, ShellParams } from "./types";

const barAggregateShell: ShellDefinition = {
    family: "categorical_aggregate",
    signatures: [["nominal", "quantitative"]],
    mark: "bar",
    required: {
        x: { type: "nominal" },
        y: { type: "quantitative", aggregate: true },
    },
    optional: {
        color: { type: "nominal" },
    },
    constraints: {
        aggregateRequired: true,
    },
};

const values = [
    { "Heart Disease": "Presence", Cholesterol: 250 },
    { "Heart Disease": "Absence", Cholesterol: 180 },
];

describe("compileVegaLite", () => {
    it("produces a valid Vega-Lite spec for bar aggregate", () => {
        const params: ShellParams = {
            x: "Heart Disease",
            y: "Cholesterol",
            aggregate: "mean",
        };

        const spec = compileVegaLite(barAggregateShell, params, values);

        expect(spec.$schema).toBe("https://vega.github.io/schema/vega-lite/v5.json");

        expect(spec.data.values).toEqual(values);

        expect(spec.mark).toEqual({ type: "bar" });

        expect(spec.encoding.x).toEqual({
            field: "Heart Disease",
            type: "nominal",
        });

        expect(spec.encoding.y).toEqual({
            field: "Cholesterol",
            type: "quantitative",
            aggregate: "mean",
        });

        expect(spec.encoding.color).toBeUndefined();
    });

    it("includes optional color encoding when provided", () => {
        const params: ShellParams = {
            x: "Heart Disease",
            y: "Cholesterol",
            color: "Heart Disease",
            aggregate: "mean",
        };

        const spec = compileVegaLite(barAggregateShell, params, values);

        expect(spec.encoding.color).toEqual({
            field: "Heart Disease",
            type: "nominal",
        });
    });

    it("does not include aggregate when shell does not define it", () => {
        const scatterShell: ShellDefinition = {
            family: "correlation",
            signatures: [["quantitative", "quantitative"]],
            mark: "point",
            required: {
                x: { type: "quantitative" },
                y: { type: "quantitative" },
            },
        };

        const params: ShellParams = {
            x: "Cholesterol",
            y: "Cholesterol",
        };

        const spec = compileVegaLite(scatterShell, params, values);

        expect(spec.mark).toEqual({ type: "point" });

        expect(spec.encoding.x).toEqual({
            field: "Cholesterol",
            type: "quantitative",
        });

        expect(spec.encoding.y).toEqual({
            field: "Cholesterol",
            type: "quantitative",
        });

        expect(spec.encoding.y.aggregate).toBeUndefined();
    });

    it("respects bin constraint on required encoding", () => {
        const histogramShell: ShellDefinition = {
            family: "distribution",
            signatures: [["quantitative"]],
            mark: "bar",
            required: {
                x: { type: "quantitative", bin: true },
                y: { type: "quantitative", aggregate: "count" },
            },
        };

        const params: ShellParams = {
            x: "Cholesterol",
        };

        const spec = compileVegaLite(histogramShell, params, values);

        expect(spec.encoding.x).toEqual({
            field: "Cholesterol",
            type: "quantitative",
            bin: true,
        });

        expect(spec.encoding.y).toEqual({
            field: undefined,
            type: "quantitative",
            aggregate: "count",
        });
    });
});
