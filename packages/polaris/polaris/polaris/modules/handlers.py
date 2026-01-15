"""Node handlers for agent graph execution."""

import asyncio
from typing import TYPE_CHECKING, Any, Protocol

from .constants import ErrorCode, NodeType, Operation

if TYPE_CHECKING:
    from .registry import Registry

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


class ControlHandler:
    """Handler for control nodes."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        decided = runner.eval_branch(node.get("condition"), ctx)
        ctx["result"] = decided
        return {"ok": True, "result": decided}


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
        from .runner import Runner

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


class PlannerHandler:
    """Handler for planner nodes."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        planned = await registry.plan(
            ctx,
            {
                "node": node,
                "prompt": node.get("prompt", ""),
                "tools": node.get("tools", []),
                "output_schema": node.get("output_schema"),
            },
        )
        ctx["result"] = planned
        runner.apply_emit(node.get("emit"), {"result": planned}, ctx)
        return {"ok": True, "result": planned}


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


class TerminalHandler:
    """Handler for terminal nodes."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        if node.get("output") is not None:
            runner.state["output"] = runner.resolve_templates(node.get("output"), ctx)
        return {"ok": True, "result": runner.state.get("output")}


class LoopHandler:
    """Handler for loop nodes - supports sequential or concurrent execution."""

    async def execute(
        self,
        node: NodeDefinition,
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        # Resolve the array to iterate over
        over_spec = node.get("over")
        items = runner.resolve_templates(over_spec, ctx)

        if not isinstance(items, list):
            return {
                "ok": False,
                "error": {
                    "code": ErrorCode.LOOP_INVALID_OVER,
                    "message": f"'over' must resolve to a list, got {type(items).__name__}",
                },
            }

        # Get loop configuration
        as_var = node.get("as", "item")
        delay = node.get("delay", 0)
        concurrency = node.get("concurrency", 1)  # 1 = sequential, N = concurrent
        on_error = node.get("on_error", "continue")  # "continue" or "stop"
        when_spec = node.get("when")  # Optional condition to filter iterations
        execute_spec = node.get("execute", {})
        emit_spec = node.get("emit", {})

        # Choose execution mode
        if concurrency > 1 and len(items) > 1:
            return await self._execute_concurrent(
                items, as_var, delay, concurrency, on_error, when_spec,
                execute_spec, emit_spec, ctx, registry, runner
            )
        else:
            return await self._execute_sequential(
                items, as_var, delay, on_error, when_spec,
                execute_spec, emit_spec, ctx, registry, runner
            )

    async def _execute_sequential(
        self,
        items: list[Any],
        as_var: str,
        delay: float,
        on_error: str,
        when_spec: dict[str, Any] | None,
        execute_spec: dict[str, Any],
        emit_spec: dict[str, Any],
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        """Execute loop iterations sequentially."""
        results: list[Any] = []
        errors: list[dict[str, Any]] = []
        skipped = 0

        for index, item in enumerate(items):
            # Set up loop context
            ctx["loop"] = {
                as_var: item,
                "index": index,
                "length": len(items),
                "first": index == 0,
                "last": index == len(items) - 1,
            }

            # Check when condition - skip if false
            if when_spec is not None:
                condition = runner.resolve_templates(when_spec, ctx)
                if not condition:
                    skipped += 1
                    continue

            # Execute the operation for this iteration
            iteration_result = await self._execute_iteration(
                execute_spec, ctx, registry, runner
            )

            if iteration_result.get("ok"):
                results.append(iteration_result.get("result"))
                # Apply emit for this iteration
                self._apply_loop_emit(emit_spec, iteration_result, ctx, runner)
            else:
                errors.append(
                    {"index": index, "item": item, "error": iteration_result.get("error")}
                )
                # Stop on first error if on_error is "stop"
                if on_error == "stop":
                    break

            # Delay between iterations (skip delay after last item)
            if delay > 0 and index < len(items) - 1:
                await asyncio.sleep(delay)

        # Clean up loop context
        ctx.pop("loop", None)

        return self._build_result(results, errors, skipped, on_error, ctx)

    async def _execute_concurrent(
        self,
        items: list[Any],
        as_var: str,
        delay: float,
        concurrency: int,
        on_error: str,
        when_spec: dict[str, Any] | None,
        execute_spec: dict[str, Any],
        emit_spec: dict[str, Any],
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        """Execute loop iterations concurrently with semaphore-based rate limiting."""
        semaphore = asyncio.Semaphore(concurrency)
        # Pre-allocate results array to preserve order
        iteration_results: list[dict[str, Any] | None] = [None] * len(items)

        async def run_iteration(index: int, item: Any) -> None:
            async with semaphore:
                # Rate limiting delay (applied before each request)
                if delay > 0 and index > 0:
                    await asyncio.sleep(delay)

                # Create isolated context for this iteration
                iter_ctx: Context = {
                    "loop": {
                        as_var: item,
                        "index": index,
                        "length": len(items),
                        "first": index == 0,
                        "last": index == len(items) - 1,
                    }
                }

                # Check when condition - mark as skipped if false
                if when_spec is not None:
                    condition = runner.resolve_templates(when_spec, iter_ctx)
                    if not condition:
                        iteration_results[index] = {"skipped": True}
                        return

                # Execute the operation
                result = await self._execute_iteration(
                    execute_spec, iter_ctx, registry, runner
                )
                iteration_results[index] = {
                    "item": item,
                    "result": result,
                    "ctx": iter_ctx,
                }

        # Run all iterations concurrently
        await asyncio.gather(*[
            run_iteration(i, item) for i, item in enumerate(items)
        ])

        # Process results in order and apply emit
        results: list[Any] = []
        errors: list[dict[str, Any]] = []
        skipped = 0

        for index, iter_data in enumerate(iteration_results):
            if iter_data is None:
                continue

            # Handle skipped iterations
            if iter_data.get("skipped"):
                skipped += 1
                continue

            item = iter_data["item"]
            iteration_result = iter_data["result"]
            iter_ctx = iter_data["ctx"]

            if iteration_result.get("ok"):
                results.append(iteration_result.get("result"))
                # Apply emit using the iteration's context
                ctx["loop"] = iter_ctx["loop"]
                self._apply_loop_emit(emit_spec, iteration_result, ctx, runner)
            else:
                errors.append(
                    {"index": index, "item": item, "error": iteration_result.get("error")}
                )

        # Clean up loop context
        ctx.pop("loop", None)

        return self._build_result(results, errors, skipped, on_error, ctx)

    def _build_result(
        self,
        results: list[Any],
        errors: list[dict[str, Any]],
        skipped: int,
        on_error: str,
        ctx: Context,
    ) -> Result:
        """Build the final result from collected results, errors, and skipped count."""
        # Set final result in context
        ctx["result"] = results

        # Return ok: false only if on_error is "stop" and there were errors
        if errors and on_error == "stop":
            return {
                "ok": False,
                "error": {
                    "code": ErrorCode.LOOP_ITERATION_FAILED,
                    "message": f"{len(errors)} iteration(s) failed",
                    "details": errors,
                },
                "partial_results": results,
            }

        # Build success result
        result: Result = {"ok": True, "result": results}

        # Add warnings for errors (API failures etc.)
        if errors:
            result["warnings"] = {
                "code": ErrorCode.LOOP_ITERATION_FAILED,
                "message": f"{len(errors)} iteration(s) failed",
                "failed_count": len(errors),
            }

        # Add info about skipped iterations (from when condition)
        if skipped > 0:
            if "warnings" not in result:
                result["warnings"] = {}
            result["warnings"]["skipped_count"] = skipped

        return result

    async def _execute_iteration(
        self,
        execute_spec: dict[str, Any],
        ctx: Context,
        registry: "Registry",
        runner: Any,
    ) -> Result:
        """Execute a single loop iteration."""
        op = execute_spec.get("op")
        resolved_input = runner.resolve_templates(execute_spec.get("input"), ctx)

        if op == Operation.API_CALL:
            target = execute_spec.get("target")
            called = await registry.call_api(
                ctx, {"target": target, "input": resolved_input}
            )
            return called
        elif op == Operation.WAIT:
            seconds = resolved_input.get("seconds", 0) if resolved_input else 0
            await asyncio.sleep(seconds)
            return {"ok": True, "result": None}
        else:
            return {
                "ok": False,
                "error": {"code": ErrorCode.UNKNOWN_EXECUTOR_OP, "message": str(op)},
            }

    def _apply_loop_emit(
        self,
        emit_spec: dict[str, Any],
        iteration_result: dict[str, Any],
        ctx: Context,
        runner: Any,
    ) -> None:
        """Apply emit rules for a single loop iteration."""
        if not emit_spec:
            return

        # Make iteration result available in context for template resolution
        ctx["result"] = iteration_result.get("result")

        for dest, src in emit_spec.items():
            key = dest[6:] if dest.startswith("state.") else dest

            # Handle $append directive - append to existing array
            if isinstance(src, dict) and "$append" in src:
                append_src = src["$append"]
                if append_src == "result":
                    value = iteration_result.get("result")
                else:
                    value = runner.resolve_templates(append_src, ctx)

                # Initialize array if needed
                if key not in runner.state:
                    runner.state[key] = []
                if isinstance(runner.state[key], list):
                    runner.state[key].append(value)
            else:
                # Normal emit behavior - this overwrites each iteration
                if isinstance(src, dict):
                    runner.state[key] = runner.resolve_templates(src, ctx)
                elif isinstance(src, str):
                    runner.state[key] = iteration_result.get(src)
                else:
                    runner.state[key] = src


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
