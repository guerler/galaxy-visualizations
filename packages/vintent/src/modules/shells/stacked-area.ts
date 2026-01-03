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

export class StackedAreaShell implements ShellType {
    analysis: AnalysisType | undefined = undefined;
    name = "Stacked Area Chart";
    optional: EncodingMapType = {
        tooltip: { type: "any" },
    };
    required: EncodingMapType = {
        color: { type: "nominal" },
        x: { type: "any" },
        y: { type: "quantitative" },
    };
    rowSemantics = "rowwise" as const;
    signatures: FieldType[][] = [
        ["ordinal", "quantitative", "nominal"],
        ["temporal", "quantitative", "nominal"],
    ];

    compile(params: ShellParamsType, values: Record<string, unknown>[], renderer: "vega-lite"): unknown {
        if (renderer !== "vega-lite") {
            throw new Error("Unsupported renderer");
        }

        return {
            $schema: VEGA_LITE_SCHEMA,
            data: { values },
            encoding: {
                color: {
                    field: params.color,
                    type: "nominal",
                },
                x: {
                    field: params.x,
                },
                y: {
                    aggregate: "sum",
                    field: params.y,
                    stack: "zero",
                    type: "quantitative",
                },
                ...(params.tooltip
                    ? {
                          tooltip: {
                              field: params.tooltip,
                          },
                      }
                    : {}),
            },
            mark: { type: "area" },
        };
    }

    validate(params: ShellParamsType, profile: DatasetProfile): ValidationResult {
        const { color, x, y } = params;

        if (!x || !y || !color) {
            return {
                errors: [{ code: "missing_required_encoding" }],
                ok: false,
                warnings: [],
            };
        }

        const xMeta = profile.fields[x];
        const yMeta = profile.fields[y];
        const cMeta = profile.fields[color];

        if (!xMeta || !yMeta || !cMeta) {
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
                            encoding: "y",
                            expected: "quantitative",
                            field: y,
                        },
                    },
                ],
                ok: false,
                warnings: [],
            };
        }

        if (cMeta.type !== "nominal" && cMeta.type !== "ordinal") {
            return {
                errors: [
                    {
                        code: "invalid_field_type",
                        details: {
                            encoding: "color",
                            expected: ["nominal", "ordinal"],
                            field: color,
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
