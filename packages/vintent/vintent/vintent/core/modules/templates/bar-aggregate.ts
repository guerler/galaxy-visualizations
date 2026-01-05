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

export class BarAggregateShell implements ShellType {
    analysis: AnalysisType | undefined = undefined;
    name = "Bar Diagram";
    optional: EncodingMapType = {
        color: { type: "nominal" },
        tooltip: { type: "any" },
    };
    required: EncodingMapType = {
        x: { type: "nominal" },
        y: { aggregate: true, type: "quantitative" },
    };
    rowSemantics = "aggregate" as const;
    signatures: FieldType[][] = [
        ["nominal", "quantitative"],
        ["ordinal", "quantitative"],
    ];

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
                aggregate: "mean",
                field: params.y,
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
        const yField = params.y;

        if (!xField || !yField) {
            return {
                errors: [{ code: "missing_required_encoding" }],
                ok: false,
                warnings: [],
            };
        }

        const xMeta = profile.fields[xField];
        const yMeta = profile.fields[yField];

        if (!xMeta || !yMeta) {
            return {
                errors: [{ code: "unknown_field" }],
                ok: false,
                warnings: [],
            };
        }

        if (yMeta.type !== "quantitative") {
            return {
                errors: [
                    {
                        code: "invalid_field_type",
                        details: {
                            actual: yMeta.type,
                            encoding: "y",
                            expected: "quantitative",
                            field: yField,
                        },
                    },
                ],
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
