import { shells } from "@/modules/shells/shells";
import { type DatasetProfile } from "@/modules/csv/profiler";

export function buildChooseShellTool(profile: DatasetProfile) {
    const compatibleShellIds = Object.entries(shells)
        .filter(([_, shell]) =>
            shell.signatures.some((sig: string[]) =>
                sig.every((type: string) => Object.values(profile.fields).some((f) => f.type === type)),
            ),
        )
        .map(([id]) => id);
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
                        enum: compatibleShellIds,
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
    const required: string[] = [];
    function fieldsForType(expectedType: string): string[] {
        if (expectedType === "any") {
            return Object.keys(profile.fields);
        }
        if (expectedType === "temporal") {
            return Object.entries(profile.fields)
                .filter(([_, meta]) => meta.type === "temporal")
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
                required.push(encoding);
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
                required,
                additionalProperties: false,
            },
        },
    };
}

function hasBin(shell: any): boolean {
    return Object.values(shell.required || {}).some((v: any) => v.bin === true);
}

function isEncodingSpec(spec: unknown): spec is { type: string; aggregate?: boolean; bin?: boolean } {
    return typeof spec === "object" && spec !== null && "type" in spec && typeof (spec as any).type === "string";
}
