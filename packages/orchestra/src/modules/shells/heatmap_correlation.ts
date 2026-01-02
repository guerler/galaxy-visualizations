import type { DatasetProfile } from "@/modules/csv/profiler";
import type { ValidationResult } from "@/modules/vega/types";
import type { FieldType, ShellInterface } from "@/modules/shells/types";

const VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v5.json";

export class CorrelationHeatmapShell implements ShellInterface {
    id = "heatmap_correlation";
    name = "Correlation Heatmap";
    family = "correlation_matrix";

    analysis = { language: "python", id: "correlation_matrix" };
    signatures: FieldType[][] = [["quantitative", "quantitative"]];
    required = {};
    optional = {};

    rowSemantics = "aggregate" as const;

    validate(_params: Record<string, any>, profile: DatasetProfile): ValidationResult {
        const quantitativeCount = Object.values(profile.fields).filter((f) => f.type === "quantitative").length;
        if (quantitativeCount < 2) {
            return {
                ok: false,
                errors: [{ code: "not_enough_quantitative_fields" }],
                warnings: [],
            };
        }
        return {
            ok: true,
            errors: [],
            warnings: [],
        };
    }

    compile(_params: Record<string, any>, values: Record<string, unknown>[], renderer: "vega-lite"): unknown {
        if (renderer !== "vega-lite") {
            throw new Error("Unsupported renderer");
        }
        return {
            $schema: VEGA_LITE_SCHEMA,
            data: { values },
            mark: { type: "rect" },
            encoding: {
                x: { field: "x", type: "nominal" },
                y: { field: "y", type: "nominal" },
                color: {
                    aggregate: "mean",
                    field: "value",
                    type: "quantitative",
                    scale: { scheme: "redblue", domain: [-1, 1] },
                },
                tooltip: [
                    { field: "x", type: "nominal" },
                    { field: "y", type: "nominal" },
                    { field: "value", type: "quantitative", format: ".2f" },
                ],
            },
        };
    }
}
