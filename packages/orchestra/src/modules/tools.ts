import { shells } from "@/modules/vega/shells";
import { type DatasetProfile } from "@/modules/csv/profiler";

export function buildChooseShellTool() {
    return {
        type: "function",
        function: {
            name: "choose_shell",
            description: "You must select the most appropriate visualization shell for the user request.",
            parameters: {
                type: "object",
                properties: {
                    shellId: {
                        type: "string",
                        enum: Object.keys(shells),
                        description: "The id of the selected visualization shell. Must be one of the available shells.",
                    },
                },
                required: ["shellId"],
                additionalProperties: false,
            },
        },
    };
}

export function buildFillShellParamsTool(shell: any, profile: DatasetProfile) {
    const properties: Record<string, any> = {};
    function fieldsForType(expectedType: string): string[] {
        if (expectedType === "any") {
            return Object.keys(profile.fields);
        }
        if (expectedType === "temporal") {
            const temporal = Object.entries(profile.fields)
                .filter(([_, meta]) => meta.type === "temporal")
                .map(([name]) => name);
            if (temporal.length > 0) {
                return temporal;
            }
            return Object.entries(profile.fields)
                .filter(([_, meta]) => meta.type === "nominal" || meta.type === "quantitative")
                .map(([name]) => name);
        }
        return Object.entries(profile.fields)
            .filter(([_, meta]) => meta.type === expectedType)
            .map(([name]) => name);
    }
    for (const [encoding, spec] of Object.entries(shell.required || {})) {
        if (isEncodingSpec(spec)) {
            if (typeof spec.aggregate === "string") {
                continue;
            }
            const fields = fieldsForType(spec.type);
            if (fields.length > 0) {
                properties[encoding] = {
                    type: "string",
                    enum: fields,
                };
            }
        }
    }
    for (const [encoding, spec] of Object.entries(shell.optional || {})) {
        if (isEncodingSpec(spec)) {
            const fields = fieldsForType(spec.type);
            if (fields.length > 0) {
                properties[encoding] = {
                    type: "string",
                    enum: fields,
                };
            }
        }
    }
    if (shell.constraints?.aggregateRequired || hasAggregate(shell)) {
        properties.aggregate = {
            type: "string",
            enum: ["count", "sum", "mean", "median", "min", "max"],
        };
    }
    if (hasBin(shell)) {
        properties.bin = {
            type: "boolean",
        };
    }
    return {
        type: "function",
        function: {
            name: "fill_shell_params",
            description: "Fill parameters for the selected visualization shell",
            parameters: {
                type: "object",
                properties,
                additionalProperties: false,
            },
        },
    };
}

function hasAggregate(shell: any): boolean {
    return Object.values(shell.required || {}).some((v: any) => v.aggregate === true);
}

function hasBin(shell: any): boolean {
    return Object.values(shell.required || {}).some((v: any) => v.bin === true);
}

function isEncodingSpec(spec: unknown): spec is { type: string; aggregate?: boolean; bin?: boolean } {
    return typeof spec === "object" && spec !== null && "type" in spec && typeof (spec as any).type === "string";
}
