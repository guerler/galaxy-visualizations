"""Tests for node handlers."""

import pytest

from polaris.modules.constants import ErrorCode, NodeType, Operation
from polaris.modules.handlers import (
    ComputeHandler,
    ControlHandler,
    ExecutorHandler,
    LoopHandler,
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


class TestLoopHandler:
    @pytest.mark.asyncio
    async def test_loop_over_array(self, mock_context):
        """Test basic loop iteration over an array."""
        handler = LoopHandler()
        runner = MockLoopRunner()
        registry = MockRegistry()
        node = {
            "type": "loop",
            "over": [{"id": 1}, {"id": 2}, {"id": 3}],
            "as": "item",
            "execute": {
                "op": Operation.API_CALL,
                "target": "test.endpoint",
                "input": {"item_id": "test"},
            },
            "emit": {
                "state.results": {"$append": "result"},
            },
        }

        result = await handler.execute(node, mock_context, registry, runner)

        assert result["ok"] is True
        assert len(result["result"]) == 3
        assert runner.state["results"] == [{"data": "test"}] * 3

    @pytest.mark.asyncio
    async def test_loop_with_ref_resolution(self, mock_context):
        """Test loop resolves $ref for over array."""
        handler = LoopHandler()
        runner = MockLoopRunner()
        runner.state["items"] = [{"id": "a"}, {"id": "b"}]
        registry = MockRegistry()
        node = {
            "type": "loop",
            "over": {"$ref": "state.items"},
            "as": "item",
            "execute": {
                "op": Operation.API_CALL,
                "target": "test.endpoint",
            },
        }

        result = await handler.execute(node, mock_context, registry, runner)

        assert result["ok"] is True
        assert len(result["result"]) == 2

    @pytest.mark.asyncio
    async def test_loop_context_available(self, mock_context):
        """Test loop context variables are available during iteration."""
        handler = LoopHandler()
        runner = MockLoopRunner()
        registry = MockRegistry()
        captured_contexts = []

        async def capture_call_api(ctx, spec):
            captured_contexts.append({
                "loop": ctx.get("loop", {}).copy() if ctx.get("loop") else None,
            })
            return {"ok": True, "result": {"data": "test"}}

        registry.call_api = capture_call_api

        node = {
            "type": "loop",
            "over": [{"name": "first"}, {"name": "second"}],
            "as": "job",
            "execute": {
                "op": Operation.API_CALL,
                "target": "test.endpoint",
            },
        }

        await handler.execute(node, mock_context, registry, runner)

        assert len(captured_contexts) == 2
        assert captured_contexts[0]["loop"]["job"] == {"name": "first"}
        assert captured_contexts[0]["loop"]["index"] == 0
        assert captured_contexts[0]["loop"]["first"] is True
        assert captured_contexts[0]["loop"]["last"] is False
        assert captured_contexts[1]["loop"]["job"] == {"name": "second"}
        assert captured_contexts[1]["loop"]["index"] == 1
        assert captured_contexts[1]["loop"]["first"] is False
        assert captured_contexts[1]["loop"]["last"] is True

    @pytest.mark.asyncio
    async def test_loop_invalid_over_returns_error(self, mock_context):
        """Test loop returns error when over is not a list."""
        handler = LoopHandler()
        runner = MockLoopRunner()
        node = {
            "type": "loop",
            "over": "not a list",
            "execute": {"op": Operation.API_CALL},
        }

        result = await handler.execute(node, mock_context, MockRegistry(), runner)

        assert result["ok"] is False
        assert result["error"]["code"] == ErrorCode.LOOP_INVALID_OVER

    @pytest.mark.asyncio
    async def test_loop_empty_array(self, mock_context):
        """Test loop handles empty array gracefully."""
        handler = LoopHandler()
        runner = MockLoopRunner()
        node = {
            "type": "loop",
            "over": [],
            "execute": {"op": Operation.API_CALL},
        }

        result = await handler.execute(node, mock_context, MockRegistry(), runner)

        assert result["ok"] is True
        assert result["result"] == []

    @pytest.mark.asyncio
    async def test_loop_iteration_failure_reports_errors(self, mock_context):
        """Test loop collects and reports iteration failures."""
        handler = LoopHandler()
        runner = MockLoopRunner()
        registry = MockRegistry()
        registry.call_api_result = {
            "ok": False,
            "error": {"code": "API_ERROR", "message": "Failed"},
        }
        node = {
            "type": "loop",
            "over": [{"id": 1}, {"id": 2}],
            "execute": {"op": Operation.API_CALL, "target": "test.endpoint"},
        }

        result = await handler.execute(node, mock_context, registry, runner)

        assert result["ok"] is False
        assert result["error"]["code"] == ErrorCode.LOOP_ITERATION_FAILED
        assert len(result["error"]["details"]) == 2

    @pytest.mark.asyncio
    async def test_loop_cleans_up_context(self, mock_context):
        """Test loop context is cleaned up after execution."""
        handler = LoopHandler()
        runner = MockLoopRunner()
        registry = MockRegistry()
        node = {
            "type": "loop",
            "over": [{"id": 1}],
            "execute": {"op": Operation.API_CALL},
        }

        await handler.execute(node, mock_context, registry, runner)

        assert "loop" not in mock_context


class MockLoopRunner:
    """Mock runner with proper $ref resolution for loop tests."""

    def __init__(self):
        self.state = {}
        self.emitted = []

    def apply_emit(self, emit, payload, ctx):
        if emit:
            self.emitted.append({"emit": emit, "payload": payload})

    def resolve_templates(self, value, ctx):
        if isinstance(value, dict):
            if "$ref" in value:
                ref = value["$ref"]
                parts = ref.split(".")
                if parts[0] == "state":
                    obj = self.state
                    for part in parts[1:]:
                        if isinstance(obj, dict):
                            obj = obj.get(part)
                        else:
                            return None
                    return obj
                elif parts[0] == "loop":
                    obj = ctx.get("loop", {})
                    for part in parts[1:]:
                        if isinstance(obj, dict):
                            obj = obj.get(part)
                        else:
                            return None
                    return obj
                return None
            return {k: self.resolve_templates(v, ctx) for k, v in value.items()}
        elif isinstance(value, list):
            return [self.resolve_templates(v, ctx) for v in value]
        return value


class TestGetHandler:
    def test_get_known_handlers(self):
        assert get_handler(NodeType.COMPUTE) is not None
        assert get_handler(NodeType.CONTROL) is not None
        assert get_handler(NodeType.EXECUTOR) is not None
        assert get_handler(NodeType.LOOP) is not None
        assert get_handler(NodeType.PLANNER) is not None
        assert get_handler(NodeType.REASONING) is not None
        assert get_handler(NodeType.TERMINAL) is not None

    def test_get_unknown_handler(self):
        assert get_handler("unknown") is None

    def test_handlers_registry_complete(self):
        for node_type in NodeType:
            assert node_type in HANDLERS, f"Missing handler for {node_type}"
