# Polaris Architecture Review

## Current Strengths
- Clean handler pattern makes adding node types trivial
- Rich expression system for data transformation
- LLM-driven routing via PLANNER nodes
- OpenAPI auto-discovery for Galaxy APIs
- Good test coverage (87 tests)

---

## Major Gaps for Powerful Agents

### 1. No Parallel Execution (Highest Impact)
Currently impossible to:
```yaml
# This pattern is NOT supported:
fetch_data:
  parallel:
    - call: api.histories
    - call: api.datasets
    - call: api.jobs
  join: aggregate_results  # Wait for all, then continue
```

**Impact**: Can't fan-out to multiple APIs simultaneously, making multi-source data gathering slow and sequential.

### 2. No Loops/Iteration
Can't express:
```yaml
# NOT supported:
process_each_dataset:
  type: foreach
  items: {$ref: state.datasets}
  do: process_single
  collect: state.results
```

**Impact**: Processing lists requires recursive subagent calls (inefficient) or pre-processing everything in one node.

### 3. No Timeouts or Retries
```yaml
# NOT supported:
risky_api_call:
  type: executor
  timeout: 30s
  retry:
    attempts: 3
    backoff: exponential
```

**Impact**: Long-running or flaky operations can hang indefinitely. No resilience patterns.

### 4. No Conditional Execution Within Nodes
Must create separate nodes for every branch:
```yaml
# Current approach requires 3 nodes for a simple if-else
check_condition:
  type: control
  condition: ...

true_branch:
  type: executor
  ...

false_branch:
  type: executor
  ...
```

### 5. No State Transactions/Rollback
If node 5 fails after nodes 1-4 succeed, there's no way to undo partial changes. No saga/compensation patterns.

### 6. Limited Expression Operators
Missing common operations:
- `map` - transform array elements
- `filter` - select matching elements
- `reduce` - aggregate values
- `sort` - order elements
- `slice` - get subset
- `merge` - combine objects
- Math operations (`add`, `multiply`, etc.)

---

## High-Impact Features to Add

| Feature | Effort | Impact | Description |
|---------|--------|--------|-------------|
| **Parallel Node** | High | 🔥🔥🔥 | Fan-out to multiple nodes, join results |
| **ForEach Node** | Medium | 🔥🔥🔥 | Iterate over arrays with a subgraph |
| **Retry/Timeout** | Medium | 🔥🔥 | Resilience for executor nodes |
| **More Expressions** | Low | 🔥🔥 | `map`, `filter`, `reduce`, `sort` |
| **Inline Conditions** | Low | 🔥 | `if` expression operator |
| **State Namespacing** | Medium | 🔥 | Isolate node state to prevent conflicts |
| **Execution Tracing** | Low | 🔥 | Debug visibility into graph execution |

---

## Unsupported Graph Patterns

```
1. PARALLEL FAN-OUT/FAN-IN
   ┌──► Node B ──┐
A ─┼──► Node C ──┼──► E (join)
   └──► Node D ──┘

2. ITERATION/LOOPS
   ┌─────────────┐
   │             ▼
   A ──► B ──► C ──► D
         ▲         │
         └─────────┘ (while condition)

3. DYNAMIC SUBGRAPH INSTANTIATION
   A ──► [Create N copies of subgraph] ──► Join

4. EVENT-DRIVEN WAITING
   A ──► Wait for external event ──► B

5. CHECKPOINT/RESUME
   A ──► B ──► [Save checkpoint] ──► C
               [Resume from checkpoint if interrupted]
```

---

## Recommended Architecture Additions

### 1. Add PARALLEL node type
```python
class ParallelHandler:
    async def execute(self, node, ctx, registry, runner):
        branches = node.get("branches", [])
        tasks = [runner.run_subgraph(b, ctx) for b in branches]
        results = await asyncio.gather(*tasks)
        return {"ok": True, "result": results}
```

### 2. Add FOREACH node type
```python
class ForEachHandler:
    async def execute(self, node, ctx, registry, runner):
        items = runner.resolve_templates(node.get("items"), ctx)
        results = []
        for item in items:
            ctx["item"] = item
            result = await runner.run_subgraph(node.get("do"), ctx)
            results.append(result)
        return {"ok": True, "result": results}
```

### 3. Add execution options to EXECUTOR
```python
# In ExecutorHandler
timeout = node.get("timeout", 60)
retries = node.get("retries", 0)

for attempt in range(retries + 1):
    try:
        result = await asyncio.wait_for(
            self._execute_op(node, ctx, registry, runner),
            timeout=timeout
        )
        if result.get("ok"):
            return result
    except asyncio.TimeoutError:
        if attempt == retries:
            return {"ok": False, "error": {"code": "TIMEOUT"}}
```

### 4. Add more expression operators
```python
def expr_map(expr, ctx, resolve):
    items = resolve(expr.get("from"), ctx)
    template = expr.get("template")
    return [resolve(template, {**ctx, "item": item}) for item in items]

def expr_filter(expr, ctx, resolve):
    items = resolve(expr.get("from"), ctx)
    field = expr.get("field")
    equals = resolve(expr.get("equals"), ctx)
    return [item for item in items if item.get(field) == equals]

def expr_reduce(expr, ctx, resolve):
    items = resolve(expr.get("from"), ctx)
    initial = resolve(expr.get("initial"), ctx)
    # Accumulate using specified operation
    return functools.reduce(lambda acc, item: acc + item, items, initial)

def expr_sort(expr, ctx, resolve):
    items = resolve(expr.get("from"), ctx)
    key = expr.get("by")
    reverse = expr.get("descending", False)
    return sorted(items, key=lambda x: x.get(key), reverse=reverse)

def expr_slice(expr, ctx, resolve):
    items = resolve(expr.get("from"), ctx)
    start = expr.get("start", 0)
    end = expr.get("end")
    return items[start:end]

def expr_merge(expr, ctx, resolve):
    objects = [resolve(obj, ctx) for obj in expr.get("objects", [])]
    result = {}
    for obj in objects:
        if isinstance(obj, dict):
            result.update(obj)
    return result

def expr_if(expr, ctx, resolve):
    condition = resolve(expr.get("condition"), ctx)
    if condition:
        return resolve(expr.get("then"), ctx)
    return resolve(expr.get("else"), ctx)
```

---

## Implementation Priority

### Phase 1: Quick Wins (Low Effort)
1. Add expression operators: `map`, `filter`, `slice`, `sort`, `if`, `merge`
2. Add execution tracing/logging

### Phase 2: Reliability (Medium Effort)
1. Add timeout support to EXECUTOR nodes
2. Add retry with backoff to EXECUTOR nodes
3. Add state namespacing

### Phase 3: Advanced Patterns (High Effort)
1. Add FOREACH node type for iteration
2. Add PARALLEL node type for fan-out/fan-in
3. Add checkpoint/resume capability

---

## Current Node Types

| Type | Purpose | Handler |
|------|---------|---------|
| `compute` | State transitions, data prep | `ComputeHandler` |
| `control` | Branching logic | `ControlHandler` |
| `executor` | API calls, subagents, waits | `ExecutorHandler` |
| `planner` | LLM-driven routing | `PlannerHandler` |
| `reasoning` | LLM text generation | `ReasoningHandler` |
| `terminal` | Graph exit points | `TerminalHandler` |

## Current Expression Operators

| Operator | Purpose |
|----------|---------|
| `concat` | String concatenation |
| `coalesce` | First non-null value |
| `get` | Dictionary lookup with default |
| `len` | Array/string length |
| `eq` | Equality test |
| `not` | Boolean negation |
| `lookup` | Array search by field |
| `count_where` | Count matching items |
| `any` | Check if any item matches |
