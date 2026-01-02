import type { DatasetProfile } from "@/modules/csv/profiler";
import type { AnalysisType, FieldType, ShellType } from "@/modules/shells/types";
import type { ValidationResult } from "@/modules/vega/types";

const VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v5.json";

export class CorrelationHeatmapShell implements ShellType {
    analysis: AnalysisType = { language: "python", id: "correlation_matrix" };
    family = "correlation_matrix";
    id = "heatmap_correlation";
    optional = {};
    name = "Correlation Heatmap";
    required = {};
    rowSemantics = "aggregate" as const;
    signatures: FieldType[][] = [["quantitative", "quantitative"]];

    compile(_params: Record<string, any>, values: Record<string, unknown>[], renderer: "vega-lite"): unknown {
        if (renderer !== "vega-lite") {
            throw new Error("Unsupported renderer");
        }
        return {
            $schema: VEGA_LITE_SCHEMA,
            data: { values },
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
            mark: { type: "rect" },
        };
    }

    validate(_params: Record<string, any>, profile: DatasetProfile): ValidationResult {
        const quantitativeCount = Object.values(profile.fields).filter((f) => f.type === "quantitative").length;
        if (quantitativeCount < 2) {
            return {
                errors: [{ code: "not_enough_quantitative_fields" }],
                ok: false,
                warnings: [],
            };
        }
        return {
            errors: [],
            ok: true,
            warnings: [],
        };
    }
}
