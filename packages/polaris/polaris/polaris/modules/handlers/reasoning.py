"""Handler for reasoning nodes."""

from typing import TYPE_CHECKING, Any

from .base import Context, NodeDefinition, Result

if TYPE_CHECKING:
    from ..registry import Registry


class ReasoningHandler:
    """Handler for reasoning nodes."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        resolved_input = runner.resolve_templates(node.get("input", {}), ctx)
        result = await registry.reason(
            prompt=node.get("prompt", ""),
            input=resolved_input,
        )
        ctx["result"] = result
        runner.apply_emit(node.get("emit"), {"result": result}, ctx)
        return {"ok": True, "result": result}
