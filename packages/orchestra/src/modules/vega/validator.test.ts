import { describe, it, expect } from "vitest";
import { validateShellParams } from "./validator";
import { DatasetProfile, ShellDefinition, ShellParams } from "./types";

const profile: DatasetProfile = {
    fields: {
        "Heart Disease": { type: "nominal", cardinality: 2 },
        "Diagnosis Code": { type: "nominal", cardinality: 120 }, // ← add this
        Cholesterol: { type: "quantitative", cardinality: 300 },
        Age: { type: "quantitative", cardinality: 60 },
    },
    rowCount: 303,
};

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

describe("validateShellParams", () => {
    it("accepts a valid bar aggregate specification", () => {
        const params: ShellParams = {
            x: "Heart Disease",
            y: "Cholesterol",
            aggregate: "mean",
        };

        const result = validateShellParams(barAggregateShell, params, profile);

        expect(result.ok).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("rejects missing required encoding", () => {
        const params: ShellParams = {
            y: "Cholesterol",
            aggregate: "mean",
        };

        const result = validateShellParams(barAggregateShell, params, profile);

        expect(result.ok).toBe(false);
        expect(result.errors[0].code).toBe("missing_required_encoding");
    });

    it("rejects unknown field", () => {
        const params: ShellParams = {
            x: "Heart Disease",
            y: "Cholestorol", // typo
            aggregate: "mean",
        };

        const result = validateShellParams(barAggregateShell, params, profile);

        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === "unknown_field")).toBe(true);
    });

    it("rejects invalid field type", () => {
        const params: ShellParams = {
            x: "Age", // quantitative, but x expects nominal
            y: "Cholesterol",
            aggregate: "mean",
        };

        const result = validateShellParams(barAggregateShell, params, profile);

        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === "invalid_field_type")).toBe(true);
    });

    it("rejects missing aggregate when required", () => {
        const params: ShellParams = {
            x: "Heart Disease",
            y: "Cholesterol",
        };

        const result = validateShellParams(barAggregateShell, params, profile);

        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === "aggregate_missing")).toBe(true);
    });

    it("rejects invalid signature", () => {
        const params: ShellParams = {
            x: "Age",
            y: "Cholesterol",
            aggregate: "mean",
        };

        const result = validateShellParams(barAggregateShell, params, profile);

        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === "invalid_signature")).toBe(true);
    });

    it("emits warning for high cardinality color", () => {
        const params: ShellParams = {
            x: "Heart Disease",
            y: "Cholesterol",
            color: "Diagnosis Code", // nominal + high cardinality
            aggregate: "mean",
        };

        const result = validateShellParams(barAggregateShell, params, profile);

        expect(result.ok).toBe(true);
        expect(result.warnings.some((w) => w.code === "high_cardinality_color")).toBe(true);
    });
});
