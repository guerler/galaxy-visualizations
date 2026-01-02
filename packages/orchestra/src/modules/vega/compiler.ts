import { ShellDefinition, ShellParams } from "./types";

export interface VegaLiteSpec {
    $schema: string;
    data: {
        values: Record<string, unknown>[];
    };
    mark: {
        type: string;
    };
    encoding: Record<string, any>;
    transform?: any[];
}

const VEGA_LITE_SCHEMA = "https://vega.github.io/schema/vega-lite/v5.json";

export function compileVegaLite(
    shell: ShellDefinition,
    params: ShellParams,
    values: Record<string, unknown>[],
): VegaLiteSpec {
    const encoding: Record<string, any> = {};
    let transform: any[] | undefined = undefined;

    if (shell.family === "correlation_matrix") {
        return {
            $schema: VEGA_LITE_SCHEMA,
            data: { values },
            mark: { type: "rect" },
            encoding: {
                x: { field: "x", type: "nominal" },
                y: { field: "y", type: "nominal" },
                color: {
                    aggregate: "mean",
                    field: "value",
                    type: "quantitative",
                    scale: { scheme: "redblue", domain: [-1, 1] },
                },
                tooltip: [
                    { field: "x", type: "nominal" },
                    { field: "y", type: "nominal" },
                    { field: "value", type: "quantitative", format: ".2f" },
                ],
            },
        };
    }
    if (shell.family === "distribution" && shell.mark === "area") {
        const xField = (params as any).x;
        transform = [
            {
                density: xField,
                as: ["value", "density"],
            },
        ];
        encoding.x = { field: "value", type: "quantitative" };
        encoding.y = { field: "density", type: "quantitative" };
        if ((params as any).color) {
            encoding.color = {
                field: (params as any).color,
                type: "nominal",
            };
        }
        return {
            $schema: VEGA_LITE_SCHEMA,
            data: { values },
            mark: { type: shell.mark },
            encoding,
            transform,
        };
    }

    // --- required encodings ---
    for (const [channel, constraint] of Object.entries(shell.required)) {
        const field = (params as any)[channel];
        const enc: Record<string, any> = {
            type: constraint.type,
        };
        if (field !== undefined) {
            enc.field = field;
        }
        if (constraint.aggregate === true && params.aggregate) {
            enc.aggregate = params.aggregate;
        } else if (typeof constraint.aggregate === "string") {
            enc.aggregate = constraint.aggregate;
        }
        if (constraint.bin === true) {
            enc.bin = true;
        }
        encoding[channel] = enc;
    }

    // --- optional encodings ---
    if (shell.optional) {
        for (const [channel, constraint] of Object.entries(shell.optional)) {
            const field = (params as any)[channel];
            if (!field) continue;
            if (constraint === "any") {
                encoding[channel] = { field };
                continue;
            }
            encoding[channel] = {
                field,
                type: constraint.type,
            };
        }
    }

    return {
        $schema: VEGA_LITE_SCHEMA,
        data: { values },
        mark: { type: shell.mark },
        encoding,
    };
}
