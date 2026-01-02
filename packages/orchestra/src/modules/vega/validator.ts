import {
    DatasetProfile,
    ShellDefinition,
    ShellParams,
    ValidationError,
    ValidationWarning,
    ValidationResult,
    FieldType,
} from "./types";

export function validateShellParams(
    shell: ShellDefinition | undefined,
    params: ShellParams,
    profile: DatasetProfile,
): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    if (!shell) {
        return {
            ok: false,
            errors: [{ code: "unknown_shell" }],
            warnings: [],
        };
    }
    if (shell.family === "correlation_matrix") {
        const quantitativeCount = Object.values(profile.fields).filter((f) => f.type === "quantitative").length;
        if (quantitativeCount < 2) {
            return {
                ok: false,
                errors: [{ code: "not_enough_quantitative_fields" }],
                warnings: [],
            };
        }
        return {
            ok: true,
            errors: [],
            warnings: [],
        };
    }
    for (const enc of Object.keys(shell.required)) {
        const spec = shell.required[enc] as any;
        if (typeof spec.aggregate === "string") {
            continue;
        }
        if (!(enc in params) || (params as any)[enc] == null) {
            errors.push({
                code: "missing_required_encoding",
                details: { encoding: enc },
            });
        }
    }
    for (const [enc, value] of Object.entries(params)) {
        if (enc === "aggregate" || enc === "bin") {
            continue;
        }
        const spec = (shell.required as any)?.[enc] ?? (shell.optional as any)?.[enc];
        if (spec && typeof spec.aggregate === "string") {
            continue;
        }
        if (!value) {
            continue;
        }
        const field = value as string;
        if (!(field in profile.fields)) {
            errors.push({
                code: "unknown_field",
                details: { field },
            });
            continue;
        }
        const actualType = profile.fields[field].type;
        const expected =
            shell.required?.[enc]?.type ??
            (shell.optional?.[enc] !== "any" ? (shell.optional?.[enc] as any)?.type : null);
        if (expected && actualType !== expected && !(expected === "temporal" && actualType === "quantitative")) {
            errors.push({
                code: "invalid_field_type",
                details: {
                    encoding: enc,
                    field,
                    expected,
                    actual: actualType,
                },
            });
        }
    }
    if (
        shell.constraints?.aggregateRequired &&
        !Object.values(shell.required).some((s: any) => typeof s.aggregate === "string")
    ) {
        errors.push({ code: "aggregate_missing" });
    }
    if (shell.constraints?.bin && !params.bin) {
        errors.push({ code: "bin_missing" });
    }
    if (params.bin) {
        const xField = params.x;
        if (!xField || !profile.fields[xField] || profile.fields[xField].type !== "quantitative") {
            errors.push({
                code: "invalid_bin_target",
                details: { field: xField },
            });
        }
    }
    if (!errors.some((e) => e.code === "missing_required_encoding")) {
        const signature: FieldType[] = [];
        const SIGNATURE_ORDER = ["x", "y", "row", "column"];
        for (const enc of SIGNATURE_ORDER) {
            const spec = (shell.required as any)?.[enc];
            if (!spec) {
                continue;
            }
            if (typeof spec.aggregate === "string") {
                continue;
            }
            const value = (params as any)[enc];
            if (!value) {
                continue;
            }
            signature.push(profile.fields[value]?.type);
        }
        const matchesSignature = shell.signatures.some(
            (sig) =>
                sig.length === signature.length &&
                sig.every((t, i) => t === signature[i] || (t === "temporal" && signature[i] === "quantitative")),
        );
        if (!matchesSignature) {
            errors.push({
                code: "invalid_signature",
                details: {
                    signature,
                    allowed: shell.signatures,
                },
            });
        }
    }
    if (params.color) {
        const c = profile.fields[params.color]?.cardinality;
        if (c !== undefined && c > 20) {
            warnings.push({
                code: "high_cardinality_color",
                details: {
                    field: params.color,
                    cardinality: c,
                },
            });
        }
    }
    if (params.x) {
        const field = profile.fields[params.x];
        if (field && field.type !== "quantitative" && field.cardinality > 100) {
            warnings.push({
                code: "high_cardinality_x",
                details: {
                    field: params.x,
                    cardinality: field.cardinality,
                },
            });
        }
    }
    if (profile.rowCount > 5000) {
        warnings.push({
            code: "large_dataset_embedded",
            details: { rows: profile.rowCount },
        });
    }
    return {
        ok: errors.length === 0,
        errors,
        warnings,
    };
}
