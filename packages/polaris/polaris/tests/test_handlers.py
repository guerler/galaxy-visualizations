"""Tests for node handlers."""

import pytest

from polaris.modules.constants import ErrorCode, NodeType, Operation
from polaris.modules.handlers import (
    ComputeHandler,
    ControlHandler,
    ExecutorHandler,
    PlannerHandler,
    ReasoningHandler,
    TerminalHandler,
    get_handler,
    HANDLERS,
)


class MockRegistry:
    """Mock registry for handler tests."""

    def __init__(self):
        self.call_api_result = {"ok": True, "result": {"data": "test"}}
        self.plan_result = {"next": "end"}
        self.reason_result = "reasoning output"

    async def call_api(self, ctx, spec):
        return self.call_api_result

    async def plan(self, ctx, spec):
        return self.plan_result

    async def reason(self, prompt, input):
        return self.reason_result


class MockRunner:
    """Mock runner for handler tests."""

    def __init__(self):
        self.state = {}
        self.emitted = []

    def apply_emit(self, emit, payload, ctx):
        if emit:
            self.emitted.append({"emit": emit, "payload": payload})

    def eval_branch(self, condition, ctx):
        return {"next": "branch_target"}

    def resolve_templates(self, value, ctx):
        return value


class TestComputeHandler:
    @pytest.mark.asyncio
    async def test_execute_returns_ok(self, mock_context):
        handler = ComputeHandler()
        runner = MockRunner()
        node = {"type": "compute", "emit": {"state.value": "result"}}

        result = await handler.execute(node, mock_context, MockRegistry(), runner)

        assert result["ok"] is True
        assert result["result"] is None
        assert mock_context["result"] is None

    @pytest.mark.asyncio
    async def test_execute_applies_emit(self, mock_context):
        handler = ComputeHandler()
        runner = MockRunner()
        node = {"type": "compute", "emit": {"state.computed": "result"}}

        await handler.execute(node, mock_context, MockRegistry(), runner)

        assert len(runner.emitted) == 1


class TestControlHandler:
    @pytest.mark.asyncio
    async def test_execute_evaluates_branch(self, mock_context):
        handler = ControlHandler()
        runner = MockRunner()
        node = {"type": "control", "condition": {"op": "control.branch"}}

        result = await handler.execute(node, mock_context, MockRegistry(), runner)

        assert result["ok"] is True
        assert result["result"]["next"] == "branch_target"


class TestExecutorHandler:
    @pytest.mark.asyncio
    async def test_api_call_success(self, mock_context):
        handler = ExecutorHandler()
        runner = MockRunner()
        registry = MockRegistry()
        node = {
            "type": "executor",
            "run": {
                "op": Operation.API_CALL,
                "target": "test.endpoint",
                "input": {"param": "value"},
            },
        }

        result = await handler.execute(node, mock_context, registry, runner)

        assert result["ok"] is True
        assert result["result"]["data"] == "test"

    @pytest.mark.asyncio
    async def test_api_call_applies_emit(self, mock_context):
        handler = ExecutorHandler()
        runner = MockRunner()
        registry = MockRegistry()
        node = {
            "type": "executor",
            "run": {"op": Operation.API_CALL, "target": "test.endpoint"},
            "emit": {"state.data": "result"},
        }

        await handler.execute(node, mock_context, registry, runner)

        assert len(runner.emitted) == 1

    @pytest.mark.asyncio
    async def test_unknown_op_returns_error(self, mock_context):
        handler = ExecutorHandler()
        runner = MockRunner()
        node = {
            "type": "executor",
            "run": {"op": "unknown.operation"},
        }

        result = await handler.execute(node, mock_context, MockRegistry(), runner)

        assert result["ok"] is False
        assert result["error"]["code"] == ErrorCode.UNKNOWN_EXECUTOR_OP


class TestPlannerHandler:
    @pytest.mark.asyncio
    async def test_execute_calls_plan(self, mock_context):
        handler = PlannerHandler()
        runner = MockRunner()
        registry = MockRegistry()
        node = {
            "type": "planner",
            "prompt": "Test prompt",
            "tools": [],
        }

        result = await handler.execute(node, mock_context, registry, runner)

        assert result["ok"] is True
        assert result["result"]["next"] == "end"

    @pytest.mark.asyncio
    async def test_execute_applies_emit(self, mock_context):
        handler = PlannerHandler()
        runner = MockRunner()
        registry = MockRegistry()
        node = {
            "type": "planner",
            "emit": {"state.plan": "result"},
        }

        await handler.execute(node, mock_context, registry, runner)

        assert len(runner.emitted) == 1


class TestReasoningHandler:
    @pytest.mark.asyncio
    async def test_execute_calls_reason(self, mock_context):
        handler = ReasoningHandler()
        runner = MockRunner()
        registry = MockRegistry()
        node = {
            "type": "reasoning",
            "prompt": "Analyze this",
            "input": {"data": "test"},
        }

        result = await handler.execute(node, mock_context, registry, runner)

        assert result["ok"] is True
        assert result["result"] == "reasoning output"


class TestTerminalHandler:
    @pytest.mark.asyncio
    async def test_execute_sets_output(self, mock_context):
        handler = TerminalHandler()
        runner = MockRunner()
        node = {
            "type": "terminal",
            "output": {"message": "done"},
        }

        result = await handler.execute(node, mock_context, MockRegistry(), runner)

        assert result["ok"] is True
        assert runner.state["output"]["message"] == "done"

    @pytest.mark.asyncio
    async def test_execute_no_output(self, mock_context):
        handler = TerminalHandler()
        runner = MockRunner()
        node = {"type": "terminal"}

        result = await handler.execute(node, mock_context, MockRegistry(), runner)

        assert result["ok"] is True
        assert result["result"] is None


class TestGetHandler:
    def test_get_known_handlers(self):
        assert get_handler(NodeType.COMPUTE) is not None
        assert get_handler(NodeType.CONTROL) is not None
        assert get_handler(NodeType.EXECUTOR) is not None
        assert get_handler(NodeType.PLANNER) is not None
        assert get_handler(NodeType.REASONING) is not None
        assert get_handler(NodeType.TERMINAL) is not None

    def test_get_unknown_handler(self):
        assert get_handler("unknown") is None

    def test_handlers_registry_complete(self):
        for node_type in NodeType:
            assert node_type in HANDLERS, f"Missing handler for {node_type}"
