"""Expanded tests for the runner module."""

import pytest

from polaris.modules.constants import ControlOp, ErrorCode, NodeType
from polaris.modules.runner import Runner


class MockRegistry:
    """Mock registry for runner tests."""

    def __init__(self):
        self.plan_result = {"next": "end"}

    async def call_api(self, ctx, spec):
        return {"ok": True, "result": {"data": "api_response"}}

    async def plan(self, ctx, spec):
        return self.plan_result

    async def reason(self, prompt, input):
        return "reasoning result"


class TestRunner:
    @pytest.mark.asyncio
    async def test_run_missing_start(self):
        graph = {"nodes": {"a": {"type": "terminal"}}}
        runner = Runner(graph, MockRegistry())
        result = await runner.run({})

        assert result["last"]["ok"] is False
        assert result["last"]["error"]["code"] == ErrorCode.MISSING_START

    @pytest.mark.asyncio
    async def test_run_unknown_node(self):
        graph = {"start": "nonexistent", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        result = await runner.run({})

        assert result["last"]["ok"] is False
        assert result["last"]["error"]["code"] == ErrorCode.UNKNOWN_NODE

    @pytest.mark.asyncio
    async def test_run_terminal_node(self):
        graph = {
            "start": "end",
            "nodes": {
                "end": {"type": NodeType.TERMINAL, "output": {"message": "done"}},
            },
        }
        runner = Runner(graph, MockRegistry())
        result = await runner.run({"input": "test"})

        assert result["last"]["ok"] is True
        assert result["state"]["output"]["message"] == "done"

    @pytest.mark.asyncio
    async def test_run_chain_of_nodes(self):
        graph = {
            "start": "first",
            "nodes": {
                "first": {"type": NodeType.COMPUTE, "next": "second"},
                "second": {"type": NodeType.TERMINAL, "output": {"step": 2}},
            },
        }
        runner = Runner(graph, MockRegistry())
        result = await runner.run({})

        assert result["last"]["ok"] is True
        assert result["state"]["output"]["step"] == 2


class TestResolveTemplates:
    def test_resolve_simple_value(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        ctx = {}

        assert runner.resolve_templates("string", ctx) == "string"
        assert runner.resolve_templates(42, ctx) == 42
        assert runner.resolve_templates(None, ctx) is None

    def test_resolve_ref(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        runner.state["inputs"] = {"name": "test"}
        ctx = {}

        result = runner.resolve_templates({"$ref": "inputs.name"}, ctx)
        assert result == "test"

    def test_resolve_nested_dict(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        runner.state["inputs"] = {"value": 42}
        ctx = {}

        result = runner.resolve_templates(
            {"key": "static", "ref": {"$ref": "inputs.value"}}, ctx
        )
        assert result["key"] == "static"
        assert result["ref"] == 42

    def test_resolve_list(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        runner.state["inputs"] = {"a": 1, "b": 2}
        ctx = {}

        result = runner.resolve_templates(
            [{"$ref": "inputs.a"}, {"$ref": "inputs.b"}], ctx
        )
        assert result == [1, 2]


class TestApplyEmit:
    def test_emit_simple_value(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        ctx = {}

        runner.apply_emit({"state.output": "result"}, {"result": "value"}, ctx)

        assert runner.state["output"] == "value"

    def test_emit_with_state_prefix(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        ctx = {}

        runner.apply_emit({"state.data": "result"}, {"result": {"nested": True}}, ctx)

        assert runner.state["data"]["nested"] is True

    def test_emit_without_state_prefix(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        ctx = {}

        runner.apply_emit({"custom_key": "result"}, {"result": "custom"}, ctx)

        assert runner.state["custom_key"] == "custom"

    def test_emit_none_payload(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        ctx = {}

        runner.apply_emit({"state.x": "result"}, None, ctx)

        assert "x" not in runner.state

    def test_emit_dict_source(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        runner.state["inputs"] = {"value": 99}
        ctx = {}

        runner.apply_emit(
            {"state.computed": {"$ref": "inputs.value"}}, {"result": "ignored"}, ctx
        )

        assert runner.state["computed"] == 99


class TestEvalBranch:
    def test_branch_matches_first_case(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        runner.state["inputs"] = {"status": "ok"}
        ctx = {}

        condition = {
            "op": ControlOp.BRANCH,
            "cases": [
                {"when": {"inputs.status": "ok"}, "next": "success"},
                {"when": {"inputs.status": "error"}, "next": "failure"},
            ],
            "default": "unknown",
        }

        result = runner.eval_branch(condition, ctx)
        assert result["next"] == "success"

    def test_branch_falls_through_to_default(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        runner.state["inputs"] = {"status": "pending"}
        ctx = {}

        condition = {
            "op": ControlOp.BRANCH,
            "cases": [
                {"when": {"inputs.status": "ok"}, "next": "success"},
            ],
            "default": "waiting",
        }

        result = runner.eval_branch(condition, ctx)
        assert result["next"] == "waiting"

    def test_branch_no_match_no_default(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        runner.state["inputs"] = {"status": "unknown"}
        ctx = {}

        condition = {
            "op": ControlOp.BRANCH,
            "cases": [{"when": {"inputs.status": "ok"}, "next": "success"}],
        }

        result = runner.eval_branch(condition, ctx)
        assert result["next"] is None

    def test_branch_non_branch_op(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        ctx = {}

        condition = {"op": "other.op"}
        result = runner.eval_branch(condition, ctx)
        assert result["next"] is None


class TestResolveNext:
    def test_resolve_next_string(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        node = {"next": "next_node"}
        res = {"ok": True}
        ctx = {}

        result = runner.resolve_next(node, res, ctx)
        assert result == "next_node"

    def test_resolve_next_on_error(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        node = {"next": "success", "on": {"error": "error_handler"}}
        res = {"ok": False}
        ctx = {}

        result = runner.resolve_next(node, res, ctx)
        assert result == "error_handler"

    def test_resolve_next_on_ok(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        node = {"on": {"ok": "success_node"}}
        res = {"ok": True}
        ctx = {}

        result = runner.resolve_next(node, res, ctx)
        assert result == "success_node"

    def test_resolve_next_control_node(self):
        graph = {"start": "a", "nodes": {}}
        runner = Runner(graph, MockRegistry())
        node = {"type": NodeType.CONTROL}
        res = {"ok": True, "result": {"next": "branch_target"}}
        ctx = {}

        result = runner.resolve_next(node, res, ctx)
        assert result == "branch_target"
