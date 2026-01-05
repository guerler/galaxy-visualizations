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

export class DensityShell implements ShellType {
    analysis: AnalysisType | undefined = undefined;
    name = "Density Plot";
    optional: EncodingMapType = {
        color: { type: "nominal" },
        tooltip: { type: "any" },
    };
    required: EncodingMapType = {
        x: { type: "quantitative" },
    };
    rowSemantics = "aggregate" as const;
    signatures: FieldType[][] = [["quantitative"]];

    compile(params: ShellParamsType, values: Record<string, unknown>[], renderer: "vega-lite"): unknown {
        if (renderer !== "vega-lite") {
            throw new Error("Unsupported renderer");
        }

        const encoding: Record<string, any> = {
            x: {
                field: "value",
                type: "quantitative",
            },
            y: {
                field: "density",
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
            mark: { type: "area" },
            transform: [
                {
                    density: params.x,
                    as: ["value", "density"],
                },
            ],
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

        const xMeta = profile.fields[xField];
        if (!xMeta) {
            return {
                errors: [{ code: "unknown_field" }],
                ok: false,
                warnings: [],
            };
        }

        if (xMeta.type !== "quantitative") {
            return {
                errors: [
                    {
                        code: "invalid_field_type",
                        details: {
                            actual: xMeta.type,
                            encoding: "x",
                            expected: "quantitative",
                            field: xField,
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
