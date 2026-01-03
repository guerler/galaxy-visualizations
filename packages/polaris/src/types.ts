import { Component } from "vue";

export interface ConsoleMessageType {
    content: string;
    details?: any;
    icon?: Component;
    spin?: boolean;
    type?: string;
}

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export type OpResult =
    | { ok: true; result: Json }
    | { ok: false; error: { code: string; message: string; details?: Json } };

export type ExecContext = {
    inputs: Record<string, Json>;
    state: Record<string, Json>;
    nodeId: string;
    graphId: string;
};

export type ApiCallSpec = { target: string; input?: Json };

export interface Registry {
    plan: (ctx: ExecContext, spec: { tools: Json; outputSchema: Json }) => Promise<Json>;
    callApi: (ctx: ExecContext, spec: ApiCallSpec) => Promise<OpResult>;
}
