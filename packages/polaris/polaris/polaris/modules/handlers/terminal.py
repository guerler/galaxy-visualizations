"""Handler for terminal nodes."""

from typing import TYPE_CHECKING, Any

from .base import Context, NodeDefinition, Result

if TYPE_CHECKING:
    from ..registry import Registry


class TerminalHandler:
    """Handler for terminal nodes."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        if node.get("output") is not None:
            runner.state["output"] = runner.resolve_templates(node.get("output"), ctx)
        return {"ok": True, "result": runner.state.get("output")}
