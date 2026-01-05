from time import sleep

from .expressions import EXPR_OPS
from .refs import get_path

MAX_NODES = 1000


class Runner:
    def __init__(self, graph, registry):
        self.graph = graph
        self.registry = registry
        self.state = {}

    async def run(self, inputs):
        self.state["inputs"] = inputs
        node_id = self.graph.get("start")
        safety = 0
        output = None
        if node_id:
            while node_id and safety < MAX_NODES:
                safety += 1
                if node_id in self.graph.get("nodes", {}):
                    node = self.graph["nodes"][node_id]
                    res, ctx = await self.run_node(node_id, node)
                    node_id = self.resolve_next(node, res, ctx)
                    output = res
                else:
                    output = {"ok": False, "error": {"code": "unknown_node", "message": str(node_id)}}
                    node_id = None
        else:
            output = {"ok": False, "error": {"code": "missing_start", "message": "Graph has no start node"}}
        return {"state": self.state, "last": output}

    async def run_node(self, node_id, node):
        ctx = {
            "inputs": self.state.get("inputs"),
            "state": self.state,
            "nodeId": node_id,
            "graphId": self.graph.get("id"),
            "graph": self.graph,
        }
        res = None
        if node.get("type") == "compute":
            ctx["result"] = None
            self.apply_emit(node.get("emit"), {"result": None}, ctx)
            res = {"ok": True, "result": None}
        elif node.get("type") == "control":
            decided = self.eval_branch(node.get("condition"), ctx)
            ctx["result"] = decided
            res = {"ok": True, "result": decided}
        elif node.get("type") == "executor":
            run_spec = node.get("run", {})
            resolved_input = self.resolve_templates(run_spec.get("input"), ctx)
            ctx["run"] = {"input": resolved_input}
            op = run_spec.get("op")
            if op == "api.call":
                called = await self.registry.call_api(ctx, {"target": run_spec.get("target"), "input": resolved_input})
                res = called
                if called.get("ok") is True:
                    ctx["result"] = called.get("result")
                    self.apply_emit(node.get("emit"), called, ctx)
                else:
                    return called, ctx
            elif op == "system.agent.call":
                agent_id = run_spec.get("agent_id")
                if not agent_id:
                    return {"ok": False, "error": {"code": "missing_agent"}}, ctx
                subagent = self.registry.agents.resolve_agent(agent_id)
                sub_inputs = resolved_input or {}
                sub_runner = Runner(subagent, self.registry)
                sub_result = await sub_runner.run(sub_inputs)
                if not sub_result or "last" not in sub_result:
                    return {"ok": False, "error": {"code": "subagent_failed"}}, ctx
                ctx["result"] = sub_result["last"]["result"]
                self.apply_emit(node.get("emit"), {"result": ctx["result"]}, ctx)
                res = {"ok": True, "result": ctx["result"]}
            elif op == "system.wait":
                seconds = resolved_input.get("seconds", 0)
                await sleep(seconds)
                ctx["result"] = None
                self.apply_emit(node.get("emit"), {"result": None}, ctx)
                res = {"ok": True, "result": None}
            else:
                res = {"ok": False, "error": {"code": "unknown_executor_op", "message": str(op)}}
        elif node.get("type") == "planner":
            planned = await self.registry.plan(
                ctx,
                dict(
                    node=node,
                    prompt=node.get("prompt", ""),
                    tools=node.get("tools", []),
                    output_schema=node.get("output_schema"),
                ),
            )
            ctx["result"] = planned
            self.apply_emit(node.get("emit"), {"result": planned}, ctx)
            res = {"ok": True, "result": planned}
        elif node.get("type") == "reasoning":
            resolved_input = self.resolve_templates(node.get("input", {}), ctx)
            result = await self.registry.reason(
                prompt=node.get("prompt", ""),
                input=resolved_input,
            )
            ctx["result"] = result
            self.apply_emit(node.get("emit"), {"result": result}, ctx)
            res = {"ok": True, "result": result}
        elif node.get("type") == "terminal":
            if node.get("output") is not None:
                self.state["output"] = self.resolve_templates(node.get("output"), ctx)
            res = {"ok": True, "result": self.state.get("output")}
        else:
            res = {"ok": False, "error": {"code": "unknown_node_type", "message": str(node.get("type"))}}
        return res, ctx

    def apply_emit(self, emit, payload, ctx):
        if emit and payload:
            for dest, src in emit.items():
                key = dest[6:] if dest.startswith("state.") else dest
                if isinstance(src, dict):
                    self.state[key] = self.resolve_templates(src, ctx)
                else:
                    if isinstance(src, str):
                        self.state[key] = payload.get(src)
                    else:
                        self.state[key] = src

    def eval_branch(self, condition, ctx):
        next_val = None
        if condition and condition.get("op") == "control.branch":
            for c in condition.get("cases", []):
                when = c.get("when", {})
                if isinstance(when, dict):
                    ok = True
                    for k, expected in when.items():
                        actual = get_path(k, ctx, self.state)
                        if actual == expected:
                            ok = ok and True
                        else:
                            ok = False
                    if ok:
                        next_val = c.get("next")
                        break
            if next_val is None:
                next_val = condition.get("default")
        return {"next": str(next_val) if next_val is not None else None}

    def eval_expr(self, expr, ctx):
        op = expr.get("op")
        fn = EXPR_OPS.get(op)
        if fn:
            return fn(expr, ctx, self.resolve_templates)
        else:
            raise Exception(f"unknown expr op: {op}")

    def resolve_next(self, node, res, ctx):
        next_val = None
        if res and res.get("ok") is False:
            if node.get("on") and node["on"].get("error"):
                next_val = node["on"]["error"]
            else:
                next_val = None
        else:
            if node.get("type") == "control":
                next_val = res.get("result", {}).get("next") if res else None
            else:
                nv = node.get("next")
                if isinstance(nv, dict):
                    ctx["result"] = res.get("result") if res else None
                    next_val = self.resolve_templates(nv, ctx)
                else:
                    if isinstance(nv, str):
                        next_val = nv
                    else:
                        if node.get("on"):
                            if res and res.get("ok") is True:
                                if node["on"].get("ok"):
                                    next_val = node["on"]["ok"]
                                else:
                                    next_val = None
                            else:
                                next_val = None
                        else:
                            next_val = None
        return str(next_val) if next_val is not None else None

    def resolve_templates(self, value, ctx):
        if isinstance(value, dict):
            if "$ref" in value:
                return get_path(value["$ref"], ctx, self.state)
            else:
                if "$expr" in value:
                    return self.eval_expr(value["$expr"], ctx)
                else:
                    return {k: self.resolve_templates(v, ctx) for k, v in value.items()}
        else:
            if isinstance(value, list):
                return [self.resolve_templates(v, ctx) for v in value]
            else:
                return value
