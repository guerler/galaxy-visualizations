from typing import TYPE_CHECKING, Any

from .constants import MAX_NODES, ControlOp, ErrorCode, NodeType
from .exceptions import ExpressionError
from .expressions import EXPR_OPS
from .handlers import get_handler
from .refs import get_path

if TYPE_CHECKING:
    from .registry import Registry

# Type aliases
GraphDefinition = dict[str, Any]
NodeDefinition = dict[str, Any]
Context = dict[str, Any]
Result = dict[str, Any]


class Runner:
    def __init__(self, graph: GraphDefinition, registry: "Registry") -> None:
        self.graph = graph
        self.registry = registry
        self.state: dict[str, Any] = {}

    async def run(self, inputs: dict[str, Any]) -> Result:
        self.state["inputs"] = inputs
        node_id = self.graph.get("start")
        safety = 0
        output: Result | None = None
        if node_id:
            while node_id and safety < MAX_NODES:
                safety += 1
                if node_id in self.graph.get("nodes", {}):
                    node = self.graph["nodes"][node_id]
                    res, ctx = await self.run_node(node_id, node)
                    node_id = self.resolve_next(node, res, ctx)
                    output = res
                else:
                    output = {"ok": False, "error": {"code": ErrorCode.UNKNOWN_NODE, "message": str(node_id)}}
                    node_id = None
        else:
            output = {"ok": False, "error": {"code": ErrorCode.MISSING_START, "message": "Graph has no start node"}}
        return {"state": self.state, "last": output}

    async def run_node(self, node_id: str, node: NodeDefinition) -> tuple[Result, Context]:
        ctx = {
            "inputs": self.state.get("inputs"),
            "state": self.state,
            "nodeId": node_id,
            "graphId": self.graph.get("id"),
            "graph": self.graph,
        }

        node_type = node.get("type", "")
        handler = get_handler(node_type)

        if handler:
            res = await handler.execute(node, ctx, self.registry, self)
        else:
            res = {"ok": False, "error": {"code": ErrorCode.UNKNOWN_NODE_TYPE, "message": str(node_type)}}

        return res, ctx

    def apply_emit(
        self, emit: dict[str, Any] | None, payload: dict[str, Any] | None, ctx: Context
    ) -> None:
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

    def eval_branch(self, condition: dict[str, Any] | None, ctx: Context) -> dict[str, str | None]:
        next_val = None
        if condition and condition.get("op") == ControlOp.BRANCH:
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

    def eval_expr(self, expr: dict[str, Any], ctx: Context) -> Any:
        op = expr.get("op", "")
        fn = EXPR_OPS.get(op)
        if fn:
            return fn(expr, ctx, self.resolve_templates)
        else:
            raise ExpressionError(f"Unknown expression operator: {op}")

    def resolve_next(self, node: NodeDefinition, res: Result | None, ctx: Context) -> str | None:
        next_val = None
        on_handlers = node.get("on", {})

        if res and res.get("ok") is False:
            # Error case - use on.error handler if defined
            if on_handlers.get("error"):
                next_val = on_handlers["error"]
            else:
                next_val = None
        elif res and res.get("warnings") and on_handlers.get("warning"):
            # Partial success with warnings - use on.warning handler if defined
            next_val = on_handlers["warning"]
        else:
            # Success case
            if node.get("type") == NodeType.CONTROL:
                next_val = res.get("result", {}).get("next") if res else None
            else:
                nv = node.get("next")
                if isinstance(nv, dict):
                    ctx["result"] = res.get("result") if res else None
                    next_val = self.resolve_templates(nv, ctx)
                elif isinstance(nv, str):
                    next_val = nv
                elif on_handlers.get("ok"):
                    next_val = on_handlers["ok"]
                else:
                    next_val = None

        return str(next_val) if next_val is not None else None

    def resolve_templates(self, value: Any, ctx: Context) -> Any:
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
