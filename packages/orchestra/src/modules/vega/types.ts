export type FieldType = "any" | "nominal" | "ordinal" | "quantitative" | "temporal";

export interface DatasetFieldProfile {
    cardinality: number;
    type: FieldType;
}

export interface DatasetProfile {
    fields: Record<string, DatasetFieldProfile>;
    rowCount: number;
}

export type AggregateOp = "count" | "max" | "mean" | "median" | "min" | "sum";

export interface ShellParams {
    aggregate?: AggregateOp;
    bin?: boolean;
    color?: string;
    x?: string;
    y?: string;
}

export interface ShellEncodingConstraint {
    aggregate?: boolean | AggregateOp;
    bin?: boolean;
    type: FieldType;
}

export interface ShellDefinition {
    analysis?: {
        id: string;
        language: "python";
    };
    constraints?: {
        aggregateRequired?: boolean;
        bin?: boolean;
    };
    family: string;
    mark: string;
    name: string;
    optional?: Record<string, ShellEncodingConstraint | "any">;
    required: Record<string, ShellEncodingConstraint>;
    signatures: FieldType[][];
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
