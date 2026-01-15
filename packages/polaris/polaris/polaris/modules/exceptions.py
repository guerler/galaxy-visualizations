"""Polaris-specific exception hierarchy."""

from polaris.core.exceptions import AppError


class ConfigurationError(AppError):
    """Invalid or missing configuration."""

    code = "CONFIG_ERROR"


class AgentError(AppError):
    """Error related to agent definition or resolution."""

    code = "AGENT_ERROR"


class ExpressionError(AppError):
    """Error evaluating expressions."""

    code = "EXPRESSION_ERROR"


class NodeExecutionError(AppError):
    """Error executing a graph node."""

    code = "NODE_EXECUTION_ERROR"


class PlannerError(AppError):
    """Error in planner node execution."""

    code = "PLANNER_ERROR"


class ApiCallError(AppError):
    """Error calling an API operation."""

    code = "API_CALL_ERROR"


class RegistryError(AppError):
    """Error in registry operations."""

    code = "REGISTRY_ERROR"


class ProviderError(AppError):
    """Error loading or using API providers."""

    code = "PROVIDER_ERROR"
