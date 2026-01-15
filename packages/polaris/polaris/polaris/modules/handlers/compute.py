"""Handler for compute nodes."""

from typing import TYPE_CHECKING, Any

from .base import Context, NodeDefinition, Result

if TYPE_CHECKING:
    from ..registry import Registry


class ComputeHandler:
    """Handler for compute nodes."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        ctx["result"] = None
        runner.apply_emit(node.get("emit"), {"result": None}, ctx)
        return {"ok": True, "result": None}
