"""Shared fixtures for handler tests."""

import pytest


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
            # Handle $eq comparison with $ref
            if "$ref" in value and "$eq" in value:
                ref_value = self._resolve_ref(value["$ref"], ctx)
                return ref_value == value["$eq"]
            if "$ref" in value:
                return self._resolve_ref(value["$ref"], ctx)
            return {k: self.resolve_templates(v, ctx) for k, v in value.items()}
        elif isinstance(value, list):
            return [self.resolve_templates(v, ctx) for v in value]
        return value

    def _resolve_ref(self, ref, ctx):
        """Resolve a $ref path to its value."""
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
        elif parts[0] == "result":
            obj = ctx.get("result", {})
            for part in parts[1:]:
                if isinstance(obj, dict):
                    obj = obj.get(part)
                else:
                    return None
            return obj
        return None


@pytest.fixture
def mock_registry():
    """Fixture for MockRegistry."""
    return MockRegistry()


@pytest.fixture
def mock_runner():
    """Fixture for MockRunner."""
    return MockRunner()


@pytest.fixture
def mock_loop_runner():
    """Fixture for MockLoopRunner."""
    return MockLoopRunner()
