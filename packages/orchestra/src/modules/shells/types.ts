import type { DatasetProfile } from "@/modules/csv/profiler";
import type { ValidationResult } from "@/modules/vega/types";

export type Renderer = "vega-lite"; // extensible later

export interface EncodingSpec {
    type: FieldType;
    aggregate?: boolean | string;
    bin?: boolean;
}

export type EncodingSpecMap = Record<string, EncodingSpec>;

export type FieldType = "nominal" | "ordinal" | "quantitative" | "temporal" | "any";

export interface ShellInterface {
    // identity
    id: string;
    name: string;
    family: string;

    // planning / orchestration contracts
    signatures: FieldType[][];
    required: EncodingSpecMap;
    optional?: EncodingSpecMap;

    // semantic declaration
    rowSemantics: "rowwise" | "aggregate";

    // behavior
    validate(params: ShellParams, profile: DatasetProfile): ValidationResult;

    compile(params: ShellParams, values: Record<string, unknown>[], renderer: Renderer): unknown;
}

export type ShellParams = Record<string, any>;
