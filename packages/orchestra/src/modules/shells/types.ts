import type { DatasetProfile } from "@/modules/csv/profiler";
import type { ValidationResult } from "@/modules/vega/types";

export interface AnalysisType {
    id: string;
    language?: LanguageType;
}

export interface EncodingSpecType {
    type: FieldType;
    aggregate?: boolean | string;
    bin?: boolean;
}

export type EncodingMapType = Record<string, EncodingSpecType>;

export type FieldType = "nominal" | "ordinal" | "quantitative" | "temporal" | "any";

export type LanguageType = "python";

export type RendererType = "vega-lite";

export type ShellParamsType = Record<string, any>;

export interface ShellType {
    // identity
    id: string;
    name: string;
    family: string;

    // planning / orchestration contracts
    analysis?: AnalysisType;
    signatures: FieldType[][];
    required: EncodingMapType;
    optional?: EncodingMapType | "any";

    // semantic declaration
    rowSemantics: "rowwise" | "aggregate";

    // behavior
    validate(params: ShellParamsType, profile: DatasetProfile): ValidationResult;

    compile(params: ShellParamsType, values: Record<string, unknown>[], RendererType: RendererType): unknown;
}

export interface ValidationError {
    code:
        | "aggregate_missing"
        | "bin_missing"
        | "invalid_aggregate_target"
        | "invalid_bin_target"
        | "invalid_field_type"
        | "invalid_signature"
        | "missing_required_encoding"
        | "not_enough_quantitative_fields"
        | "unknown_field"
        | "unknown_shell";
    details?: Record<string, unknown>;
}

export interface ValidationWarning {
    code: "high_cardinality_color" | "high_cardinality_x" | "large_dataset_embedded";
    details?: Record<string, unknown>;
}

export interface ValidationResult {
    errors: ValidationError[];
    ok: boolean;
    warnings: ValidationWarning[];
}
