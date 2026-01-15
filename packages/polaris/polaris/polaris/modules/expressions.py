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


def expr_unique(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> list:
    """Deduplicate array items by a specified field, preserving order."""
    items = resolve(expr.get("from"), ctx)
    by_field = expr.get("by")
    if not isinstance(items, list):
        return []
    if not by_field:
        # No field specified - dedupe by entire item (for simple values)
        seen: set = set()
        result = []
        for item in items:
            key = item if not isinstance(item, dict) else id(item)
            if key not in seen:
                seen.add(key)
                result.append(item)
        return result
    # Dedupe by specific field
    seen_values: set = set()
    result = []
    for item in items:
        if isinstance(item, dict):
            value = item.get(by_field)
            if value is not None and value not in seen_values:
                seen_values.add(value)
                result.append(item)
    return result


def expr_filter(expr: ExprDict, ctx: Context, resolve: ResolveFunc) -> list:
    """Filter array items by a condition."""
    items = resolve(expr.get("from"), ctx)
    if not isinstance(items, list):
        return []

    where = expr.get("where", {})
    field = where.get("field")

    if not field:
        return items

    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        value = item.get(field)

        # Check various conditions
        if "eq" in where:
            if value == resolve(where.get("eq"), ctx):
                result.append(item)
        elif "ne" in where:
            if value != resolve(where.get("ne"), ctx):
                result.append(item)
        elif "starts_with" in where:
            if isinstance(value, str) and value.startswith(where.get("starts_with")):
                result.append(item)
        elif "not_starts_with" in where:
            if isinstance(value, str) and not value.startswith(where.get("not_starts_with")):
                result.append(item)
        elif "contains" in where:
            if isinstance(value, str) and where.get("contains") in value:
                result.append(item)
        elif "not_null" in where and where.get("not_null"):
            if value is not None:
                result.append(item)
        else:
            # No condition specified, include all
            result.append(item)

    return result


EXPR_OPS = {
    "any": expr_any,
    "concat": expr_concat,
    "coalesce": expr_coalesce,
    "count_where": expr_count_where,
    "filter": expr_filter,
    "get": expr_get,
    "len": expr_len,
    "eq": expr_eq,
    "not": expr_not,
    "lookup": expr_lookup,
    "unique": expr_unique,
}
