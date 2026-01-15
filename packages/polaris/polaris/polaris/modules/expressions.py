from typing import Any, Callable

from .exceptions import ExpressionError

# Type aliases
ExprDict = dict[str, Any]
Context = dict[str, Any]
ResolveFunc = Callable[[Any, Context], Any]


def expr_concat(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> str:
    args = [resolve(a, ctx) for a in expr.get("args", [])]
    return "".join(str(a) for a in args)


def expr_coalesce(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> Any:
    args = [resolve(a, ctx) for a in expr.get("args", [])]
    for a in args:
        if a is not None:
            return a
    return None


def expr_get(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> Any:
    obj = resolve(expr.get("obj"), ctx)
    key = resolve(expr.get("key"), ctx)
    default = resolve(expr.get("default"), ctx)
    if isinstance(obj, dict) and key in obj:
        return obj[key]
    return default


def expr_len(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> int:
    obj = resolve(expr.get("arg"), ctx)
    return len(obj) if obj is not None else 0


def expr_eq(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> bool:
    left = resolve(expr.get("left"), ctx)
    right = resolve(expr.get("right"), ctx)
    return left == right


def expr_not(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> bool:
    arg = resolve(expr.get("arg"), ctx)
    return not bool(arg)


def expr_lookup(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> Any:
    source = resolve(expr.get("from"), ctx)
    if not isinstance(source, list):
        raise ExpressionError("lookup source is not an array")
    match = expr.get("match", {})
    field = match.get("field")
    equals = resolve(match.get("equals"), ctx)
    select = expr.get("select")
    for item in source:
        if item.get(field) == equals:
            if select not in item:
                raise ExpressionError("lookup select field not found")
            return item[select]
    raise ExpressionError("lookup found no match")


def expr_count_where(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> int:
    items = resolve(expr.get("from"), ctx)
    field = expr.get("field")
    equals = resolve(expr.get("equals"), ctx)
    if not isinstance(items, list):
        return 0
    return sum(1 for item in items if item.get(field) == equals)


def expr_any(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> bool:
    items = resolve(expr.get("from"), ctx)
    field = expr.get("field")
    equals = resolve(expr.get("equals"), ctx)
    if not isinstance(items, list):
        return False
    return any(item.get(field) == equals for item in items)


EXPR_OPS = {
    "any": expr_any,
    "concat": expr_concat,
    "coalesce": expr_coalesce,
    "count_where": expr_count_where,
    "get": expr_get,
    "len": expr_len,
    "eq": expr_eq,
    "not": expr_not,
    "lookup": expr_lookup,
}
