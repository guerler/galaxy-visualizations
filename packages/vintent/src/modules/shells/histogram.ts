import type { DatasetProfile } from "@/modules/csv/profiler";
import type { AnalysisType, EncodingMapType, FieldType, ShellType, ValidationResult } from "@/modules/shells/types";

const VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v5.json";

export class HistogramShell implements ShellType {
    analysis: AnalysisType | undefined = undefined;
    name = "Histogram";
    optional: EncodingMapType = {
        tooltip: { type: "any" },
    };
    required: EncodingMapType = {
        x: { bin: true, type: "quantitative" },
        y: { aggregate: "count", type: "quantitative" },
    };
    rowSemantics = "aggregate" as const;
    signatures: FieldType[][] = [["quantitative"]];

    compile(params: Record<string, any>, values: Record<string, unknown>[], renderer: "vega-lite"): unknown {
        if (renderer !== "vega-lite") {
            throw new Error("Unsupported renderer");
        }
        const xField = params.x;
        return {
            $schema: VEGA_LITE_SCHEMA,
            data: { values },
            encoding: {
                x: {
                    bin: true,
                    field: xField,
                    type: "quantitative",
                },
                y: {
                    aggregate: "count",
                    type: "quantitative",
                },
            },
            mark: { type: "bar" },
        };
    }

    validate(_params: Record<string, any>, profile: DatasetProfile): ValidationResult {
        const quantitativeCount = Object.values(profile.fields).filter((f) => f.type === "quantitative").length;
        if (quantitativeCount < 1) {
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
