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

export class BarValueShell implements ShellType {
    analysis: AnalysisType | undefined = undefined;
    name = "Bar Values";
    optional: EncodingMapType = {
        tooltip: { type: "any" },
    };
    required: EncodingMapType = {
        y: { type: "quantitative" },
    };
    rowSemantics = "rowwise" as const;
    signatures: FieldType[][] = [["quantitative"]];

    compile(params: ShellParamsType, values: Record<string, unknown>[], renderer: "vega-lite"): unknown {
        if (renderer !== "vega-lite") {
            throw new Error("Unsupported renderer");
        }

        return {
            $schema: VEGA_LITE_SCHEMA,
            data: { values },
            encoding: {
                x: {
                    aggregate: "count",
                    type: "ordinal",
                },
                y: {
                    field: params.y,
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
            mark: { type: "bar" },
        };
    }

    validate(params: ShellParamsType, profile: DatasetProfile): ValidationResult {
        const yField = params.y;
        if (!yField) {
            return {
                errors: [{ code: "missing_required_encoding" }],
                ok: false,
                warnings: [],
            };
        }

        const yMeta = profile.fields[yField];
        if (!yMeta) {
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
