"""Handler for control nodes."""

from typing import TYPE_CHECKING, Any

from .base import Context, NodeDefinition, Result

if TYPE_CHECKING:
    from ..registry import Registry


class ControlHandler:
    """Handler for control nodes."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        decided = runner.eval_branch(node.get("condition"), ctx)
        ctx["result"] = decided
        return {"ok": True, "result": decided}
