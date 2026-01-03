import type { DatasetProfile } from "@/modules/csv/profiler";
import type {
    AnalysisType,
    EncodingMapType,
    FieldType,
    ShellParamsType,
    ShellType,
    ValidationResult,
} from "@/modules/shells/types";

const VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v5.json";

export class BarCountShell implements ShellType {
    analysis: AnalysisType | undefined = undefined;
    name = "Bar Count";
    optional: EncodingMapType = {
        color: { type: "nominal" },
        tooltip: { type: "any" },
    };
    required: EncodingMapType = {
        x: { type: "any" },
    };
    rowSemantics = "aggregate" as const;
    signatures: FieldType[][] = [["nominal"], ["ordinal"], ["quantitative"]];

    compile(params: ShellParamsType, values: Record<string, unknown>[], renderer: "vega-lite"): unknown {
        if (renderer !== "vega-lite") {
            throw new Error("Unsupported renderer");
        }

        const encoding: Record<string, any> = {
            x: {
                field: params.x,
                type: "nominal",
            },
            y: {
                aggregate: "count",
                type: "quantitative",
            },
        };

        if (params.color) {
            encoding.color = {
                field: params.color,
                type: "nominal",
            };
        }

        if (params.tooltip) {
            encoding.tooltip = {
                field: params.tooltip,
            };
        }

        return {
            $schema: VEGA_LITE_SCHEMA,
            data: { values },
            encoding,
            mark: { type: "bar" },
        };
    }

    validate(params: ShellParamsType, profile: DatasetProfile): ValidationResult {
        const xField = params.x;
        if (!xField) {
            return {
                errors: [{ code: "missing_required_encoding" }],
                ok: false,
                warnings: [],
            };
        }

        if (!profile.fields[xField]) {
            return {
                errors: [{ code: "unknown_field" }],
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
