"""Handler for planner nodes."""

from typing import TYPE_CHECKING, Any

from .base import Context, NodeDefinition, Result

if TYPE_CHECKING:
    from ..registry import Registry


class PlannerHandler:
    """Handler for planner nodes."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        planned = await registry.plan(
            ctx,
            {
                "node": node,
                "prompt": node.get("prompt", ""),
                "tools": node.get("tools", []),
                "output_schema": node.get("output_schema"),
            },
        )
        ctx["result"] = planned
        runner.apply_emit(node.get("emit"), {"result": planned}, ctx)
        return {"ok": True, "result": planned}
