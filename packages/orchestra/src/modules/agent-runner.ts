export class AgentRunner {
    private graph: any;
    private state: Record<string, any>;
    private registry: any;
    constructor(graph: any, registry: any) {
        this.graph = graph;
        this.registry = registry;
        this.state = {};
    }
    async run(inputs: Record<string, any>) {
        this.state.inputs = inputs;
        let nodeId = this.graph.start;
        let safety = 0;
        let output: any = null;
        if (nodeId) {
            while (nodeId && safety < 500) {
                safety += 1;
                const node = this.graph.nodes[nodeId];
                const res = await this.executeNode(nodeId, node);
                nodeId = this.resolveNext(node, res);
                output = res;
            }
        } else {
            output = { ok: false, error: { code: "missing_start", message: "Graph has no start node" } };
        }
        return { state: this.state, last: output };
    }
    private async executeNode(nodeId: string, node: any) {
        const ctx = { inputs: this.state.inputs, state: this.state, nodeId, graphId: this.graph.id, graph: this.graph };
        let res: any = null;
        if (node.type === "planner") {
            const planned = await this.registry.plan(ctx, {
                tools: node.tools ?? [],
                outputSchema: node.output_schema ?? null,
            });
            this.applyEmit(node.emit, planned);
            res = { ok: true, result: planned };
        } else if (node.type === "executor") {
            const resolvedInput = this.resolveTemplates(node.run?.input);
            if (node.run?.op === "api.call") {
                const called = await this.registry.callApi(ctx, {
                    target: node.run.target,
                    input: resolvedInput,
                });
                if (called?.ok === true) {
                    this.applyEmit(node.emit, called);
                }
                res = called;
            } else {
                if (node.run?.op === "state.select") {
                    const selected = this.runStateSelect(resolvedInput);
                    if (selected?.ok === true) {
                        this.applyEmit(node.emit, selected);
                    }
                    res = selected;
                } else {
                    throw new Error(`Unknown executor op: ${node.run?.op}`);
                }
            }
        } else if (node.type === "control") {
            const decided = this.evalBranch(node.condition);
            res = { ok: true, result: decided };
        } else if (node.type === "terminal") {
            if (node.emit) {
                const v = this.resolveInputTemplate(node.emit);
                this.state.output = v;
            } else {
                this.state.output = this.state.output ?? null;
            }
            res = { ok: true, result: this.state.output };
        } else {
            res = { ok: false, error: { code: "unknown_node_type", message: String(node.type) } };
        }
        return res;
    }
    runStateSelect(input: any) {
        const source = input.from;
        console.log("first", source);
        if (!Array.isArray(source)) {
            throw new Error("state.select: source is not an array");
        }
        console.log(source);
        let items = source;
        if (input.filter) {
            items = items.filter((item: any) => item?.[input.filter.field] === input.filter.equals);
        }
        const item = items[input.index ?? 0];
        if (!item) {
            throw new Error("state.select: index out of bounds");
        }
        if (!input.field || !(input.field in item)) {
            throw new Error("state.select: field not found");
        }
        return { ok: true, result: item[input.field] };
    }

    private resolveNext(node: any, res: any) {
        let next: any = null;
        if (node.type === "control") {
            next = res?.result?.next ?? null;
        } else if (typeof node.next === "string") {
            next = this.interpolateNext(node.next, res?.result);
        } else if (node.on) {
            if (res?.ok === true && node.on.ok) {
                next = node.on.ok;
            } else if (res?.ok === false && node.on.error) {
                next = node.on.error;
            } else {
                next = null;
            }
        } else {
            next = null;
        }
        return next;
    }
    private applyEmit(emit: any, payload: any) {
        if (emit && payload) {
            for (const dest of Object.keys(emit)) {
                const src = emit[dest];
                const key = dest.startsWith("state.") ? dest.slice(6) : dest;
                if (typeof src === "string") {
                    if (src.startsWith("${") && src.endsWith("}")) {
                        this.state[key] = this.getPath(src.slice(2, -1));
                    } else if (src === "." || src === "$self") {
                        this.state[key] = payload;
                    } else {
                        this.state[key] = payload[src];
                    }
                } else {
                    this.state[key] = src;
                }
            }
        }
    }
    resolveTemplates(value: any): any {
        if (typeof value === "string") {
            return this.resolveInputTemplate(value);
        }
        if (Array.isArray(value)) {
            return value.map((v) => this.resolveTemplates(v));
        }
        if (value && typeof value === "object") {
            const out: any = {};
            for (const [k, v] of Object.entries(value)) {
                out[k] = this.resolveTemplates(v);
            }
            return out;
        }
        return value;
    }
    private resolveInputTemplate(tpl: any): any {
        if (tpl === null || tpl === undefined) {
            return tpl;
        } else if (Array.isArray(tpl)) {
            return tpl.map((x) => this.resolveInputTemplate(x));
        } else if (typeof tpl === "object") {
            const out: any = {};
            for (const k of Object.keys(tpl)) {
                out[k] = this.resolveInputTemplate(tpl[k]);
            }
            return out;
        } else if (typeof tpl === "string" && tpl.startsWith("${") && tpl.endsWith("}")) {
            return this.getPath(tpl.slice(2, -1));
        } else {
            return tpl;
        }
    }
    private interpolateNext(next: string, planned: any) {
        let out = next;
        if (next.startsWith("${") && next.endsWith("}")) {
            const key = next.slice(2, -1);
            if (planned && planned[key] !== undefined) {
                out = String(planned[key]);
            } else {
                out = null as any;
            }
        }
        return out;
    }
    private evalBranch(condition: any) {
        let next: string | null = null;
        if (condition?.op === "control.branch" && Array.isArray(condition.cases)) {
            for (const c of condition.cases) {
                const path = c?.when?.path;
                const equals = c?.when?.equals;
                if (typeof path === "string") {
                    const v = this.getPath(path);
                    if (v === equals) {
                        next = String(c.next);
                        break;
                    } else {
                        next = next;
                    }
                } else {
                    next = next;
                }
            }
            if (!next) {
                next = condition.default ? String(condition.default) : null;
            } else {
                next = next;
            }
        } else {
            next = null;
        }
        return { next };
    }
    private getPath(path: string) {
        const parts = path.replace(/^state\./, "").split(".");
        let cur: any = this.state;
        for (const p of parts) {
            if (cur && typeof cur === "object" && p in cur) {
                cur = cur[p];
            } else {
                cur = undefined;
            }
        }
        return cur;
    }
}
