"""Handler for executor nodes."""

import asyncio
from typing import TYPE_CHECKING, Any

from ..constants import ErrorCode, Operation
from .base import Context, NodeDefinition, Result

if TYPE_CHECKING:
    from ..registry import Registry


class ExecutorHandler:
    """Handler for executor nodes."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        run_spec = node.get("run", {})
        resolved_input = runner.resolve_templates(run_spec.get("input"), ctx)
        ctx["run"] = {"input": resolved_input}
        op = run_spec.get("op")

        if op == Operation.API_CALL:
            return await self._handle_api_call(node, ctx, registry, runner, run_spec, resolved_input)
        elif op == Operation.AGENT_CALL:
            return await self._handle_agent_call(node, ctx, registry, runner, run_spec, resolved_input)
        elif op == Operation.WAIT:
            return await self._handle_wait(node, ctx, runner, resolved_input)
        else:
            return {"ok": False, "error": {"code": ErrorCode.UNKNOWN_EXECUTOR_OP, "message": str(op)}}

    async def _handle_api_call(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
        run_spec: dict[str, Any],
        resolved_input: Any,
    ) -> Result:
        called = await registry.call_api(ctx, {"target": run_spec.get("target"), "input": resolved_input})
        if called.get("ok") is True:
            ctx["result"] = called.get("result")
            runner.apply_emit(node.get("emit"), called, ctx)
        return called

    async def _handle_agent_call(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
        run_spec: dict[str, Any],
        resolved_input: Any,
    ) -> Result:
        # Import here to avoid circular import
        from ..runner import Runner

        agent_id = run_spec.get("agent_id")
        if not agent_id:
            return {"ok": False, "error": {"code": ErrorCode.MISSING_AGENT}}

        subagent = registry.agents.resolve_agent(agent_id)
        sub_inputs = resolved_input or {}
        sub_runner = Runner(subagent, registry)
        sub_result = await sub_runner.run(sub_inputs)

        if not sub_result or "last" not in sub_result:
            return {"ok": False, "error": {"code": ErrorCode.SUBAGENT_FAILED}}

        ctx["result"] = sub_result["last"]["result"]
        runner.apply_emit(node.get("emit"), {"result": ctx["result"]}, ctx)
        return {"ok": True, "result": ctx["result"]}

    async def _handle_wait(
        self,
        node: NodeDefinition,
        ctx: Context,
        runner: Any,
        resolved_input: Any,
    ) -> Result:
        seconds = resolved_input.get("seconds", 0) if resolved_input else 0
        await asyncio.sleep(seconds)
        ctx["result"] = None
        runner.apply_emit(node.get("emit"), {"result": None}, ctx)
        return {"ok": True, "result": None}
