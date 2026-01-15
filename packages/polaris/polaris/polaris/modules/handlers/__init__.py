"""Node handlers for agent graph execution."""

from ..constants import NodeType
from .base import Context, NodeDefinition, NodeHandler, Result
from .compute import ComputeHandler
from .control import ControlHandler
from .executor import ExecutorHandler
from .loop import LoopHandler
from .planner import PlannerHandler
from .reasoning import ReasoningHandler
from .terminal import TerminalHandler

# Handler registry mapping node types to handlers
HANDLERS: dict[str, NodeHandler] = {
    NodeType.COMPUTE: ComputeHandler(),
    NodeType.CONTROL: ControlHandler(),
    NodeType.EXECUTOR: ExecutorHandler(),
    NodeType.LOOP: LoopHandler(),
    NodeType.PLANNER: PlannerHandler(),
    NodeType.REASONING: ReasoningHandler(),
    NodeType.TERMINAL: TerminalHandler(),
}


def get_handler(node_type: str) -> NodeHandler | None:
    """Get the handler for a node type."""
    return HANDLERS.get(node_type)


__all__ = [
    # Types
    "Context",
    "NodeDefinition",
    "NodeHandler",
    "Result",
    # Handlers
    "ComputeHandler",
    "ControlHandler",
    "ExecutorHandler",
    "LoopHandler",
    "PlannerHandler",
    "ReasoningHandler",
    "TerminalHandler",
    # Registry
    "HANDLERS",
    "get_handler",
]
