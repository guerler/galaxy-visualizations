"""Base types and protocols for node handlers."""

from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from ..registry import Registry

# Type aliases
Context = dict[str, Any]
Result = dict[str, Any]
NodeDefinition = dict[str, Any]


class NodeHandler(Protocol):
    """Protocol for node handlers."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        """Execute the node and return a result."""
        ...
