class AgentRunner:
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
            while node_id and safety < 500:
                safety += 1
                node = self.graph["nodes"][node_id]
                res = await self.execute_node(node_id, node)
                node_id = self.resolve_next(node, res)
                output = res
        else:
            output = {
                "ok": False,
                "error": {
                    "code": "missing_start",
                    "message": "Graph has no start node"
                }
            }
        return {"state": self.state, "last": output}

    async def execute_node(self, node_id, node):
        ctx = {
            "inputs": self.state.get("inputs"),
            "state": self.state,
            "nodeId": node_id,
            "graphId": self.graph.get("id"),
            "graph": self.graph
        }
        res = None
        if node["type"] == "planner":
            planned = await self.registry.plan(ctx, {
                "node": node,
                "prompt": node.get("prompt", ""),
                "tools": node.get("tools", []),
                "outputSchema": node.get("output_schema")
            })
            self.apply_emit(node.get("emit"), planned)
            res = {"ok": True, "result": planned}
        elif node["type"] == "executor":
            resolved_input = self.resolve_templates(node.get("run", {}).get("input"))
            op = node.get("run", {}).get("op")
            if op == "api.call":
                called = await self.registry.call_api(ctx, {
                    "target": node["run"]["target"],
                    "input": resolved_input
                })
                if called.get("ok") is True:
                    self.apply_emit(node.get("emit"), called)
                res = called
            elif op == "state.select":
                selected = self.run_state_select(resolved_input)
                if selected.get("ok") is True:
                    self.apply_emit(node.get("emit"), selected)
                res = selected
            elif op == "state.lookup":
                input_val = resolved_input
                source = input_val.get("from")
                if not isinstance(source, list):
                    raise Exception("state.lookup: source is not an array")
                match = None
                for item in source:
                    if item.get(input_val.get("match", {}).get("field")) == input_val.get("match", {}).get("equals"):
                        match = item
                        break
                if not match:
                    raise Exception("state.lookup: no match")
                select = input_val.get("select")
                if select not in match:
                    raise Exception("state.lookup: select field not found")
                res = {"ok": True, "result": match[select]}
                self.apply_emit(node.get("emit"), res)
            else:
                raise Exception(f"Unknown executor op: {op}")
        elif node["type"] == "control":
            decided = self.eval_branch(node.get("condition"))
            res = {"ok": True, "result": decided}
        elif node["type"] == "terminal":
            if node.get("emit"):
                v = self.resolve_input_template(node["emit"])
                self.state["output"] = v
            else:
                self.state["output"] = self.state.get("output")
            res = {"ok": True, "result": self.state.get("output")}
        else:
            res = {
                "ok": False,
                "error": {
                    "code": "unknown_node_type",
                    "message": str(node.get("type"))
                }
            }
        return res

    def run_state_select(self, input_val):
        source = input_val.get("from")
        if not isinstance(source, list):
            raise Exception("state.select: source is not an array")
        items = source
        filt = input_val.get("filter")
        if filt:
            items = [i for i in items if i.get(filt.get("field")) == filt.get("equals")]
        index = input_val.get("index", 0)
        if index >= len(items):
            raise Exception("state.select: index out of bounds")
        item = items[index]
        field = input_val.get("field")
        if not field or field not in item:
            raise Exception("state.select: field not found")
        return {"ok": True, "result": item[field]}

    def resolve_next(self, node, res):
        next_val = None
        if node["type"] == "control":
            next_val = res.get("result", {}).get("next")
        elif isinstance(node.get("next"), str):
            next_val = self.interpolate_next(node["next"], res.get("result"))
        elif node.get("on"):
            if res.get("ok") is True and node["on"].get("ok"):
                next_val = node["on"]["ok"]
            elif res.get("ok") is False and node["on"].get("error"):
                next_val = node["on"]["error"]
        return next_val

    def apply_emit(self, emit, payload):
        if emit and payload:
            for dest, src in emit.items():
                key = dest[6:] if dest.startswith("state.") else dest
                if isinstance(src, str):
                    if src.startswith("${") and src.endswith("}"):
                        self.state[key] = self.get_path(src[2:-1])
                    elif src in (".", "$self"):
                        self.state[key] = payload
                    else:
                        self.state[key] = payload.get(src)
                else:
                    self.state[key] = src

    def resolve_templates(self, value):
        if isinstance(value, str):
            return self.resolve_input_template(value)
        if isinstance(value, list):
            return [self.resolve_templates(v) for v in value]
        if isinstance(value, dict):
            return {k: self.resolve_templates(v) for k, v in value.items()}
        return value

    def resolve_input_template(self, tpl):
        if tpl is None:
            return tpl
        if isinstance(tpl, list):
            return [self.resolve_input_template(x) for x in tpl]
        if isinstance(tpl, dict):
            return {k: self.resolve_input_template(v) for k, v in tpl.items()}
        if isinstance(tpl, str) and tpl.startswith("${") and tpl.endswith("}"):
            return self.get_path(tpl[2:-1])
        return tpl

    def interpolate_next(self, next_val, planned):
        if next_val.startswith("${") and next_val.endswith("}"):
            key = next_val[2:-1]
            return str(planned.get(key)) if planned and key in planned else None
        return next_val

    def eval_branch(self, condition):
        next_val = None
        if condition and condition.get("op") == "control.branch":
            for c in condition.get("cases", []):
                path = c.get("when", {}).get("path")
                equals = c.get("when", {}).get("equals")
                if isinstance(path, str):
                    v = self.get_path(path)
                    if v == equals:
                        next_val = str(c.get("next"))
                        break
            if not next_val:
                default = condition.get("default")
                next_val = str(default) if default else None
        return {"next": next_val}

    def get_path(self, path):
        parts = path.replace("state.", "").split(".")
        cur = self.state
        for p in parts:
            if isinstance(cur, dict) and p in cur:
                cur = cur[p]
            else:
                return None
        return cur
