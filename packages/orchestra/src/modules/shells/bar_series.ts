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

export class BarSeriesShell implements ShellType {
    analysis: AnalysisType | undefined = undefined;
    name = "Multi-Series Bar Chart";
    optional: EncodingMapType = { tooltip: { type: "any" } };
    required: EncodingMapType = { values: { type: "quantitative" } };
    rowSemantics = "rowwise" as const;
    signatures: FieldType[][] = [["quantitative"]];
    compile(params: ShellParamsType, values: Record<string, unknown>[], renderer: "vega-lite"): unknown {
        if (renderer !== "vega-lite") {
            throw new Error("Unsupported renderer");
        } else {
            const fields: string[] = params.values;
            return {
                $schema: VEGA_LITE_SCHEMA,
                data: { values },
                transform: [
                    { window: [{ op: "row_number", as: "category" }] },
                    { fold: fields, as: ["group", "value"] },
                ],
                mark: "bar",
                encoding: {
                    x: { field: "category", type: "ordinal" },
                    xOffset: { field: "group", type: "nominal" },
                    y: { field: "value", type: "quantitative" },
                    color: { field: "group", type: "nominal" },
                    ...(params.tooltip ? { tooltip: { field: params.tooltip } } : {}),
                },
            };
        }
    }
    validate(params: ShellParamsType, profile: DatasetProfile): ValidationResult {
        const fields: unknown = params.values;
        if (!Array.isArray(fields) || fields.length < 2) {
            return { errors: [{ code: "not_enough_fields" }], ok: false, warnings: [] };
        } else {
            for (const field of fields) {
                const meta = profile.fields[field];
                if (!meta) {
                    return { errors: [{ code: "unknown_field", details: { field } }], ok: false, warnings: [] };
                } else {
                    if (meta.type !== "quantitative") {
                        return {
                            errors: [
                                {
                                    code: "invalid_field_type",
                                    details: { actual: meta.type, expected: "quantitative", field },
                                },
                            ],
                            ok: false,
                            warnings: [],
                        };
                    } else {
                    }
                }
            }
            return { errors: [], ok: true, warnings: [] };
        }
    }
}
