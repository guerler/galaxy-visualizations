def expr_concat(expr, ctx, resolve):
    args = [resolve(a, ctx) for a in expr.get("args", [])]
    return "".join(str(a) for a in args)


def expr_coalesce(expr, ctx, resolve):
    args = [resolve(a, ctx) for a in expr.get("args", [])]
    for a in args:
        if a is not None:
            return a
    return None


def expr_get(expr, ctx, resolve):
    obj = resolve(expr.get("obj"), ctx)
    key = resolve(expr.get("key"), ctx)
    default = resolve(expr.get("default"), ctx)
    if isinstance(obj, dict) and key in obj:
        return obj[key]
    return default


def expr_len(expr, ctx, resolve):
    obj = resolve(expr.get("arg"), ctx)
    return len(obj) if obj is not None else 0


def expr_eq(expr, ctx, resolve):
    left = resolve(expr.get("left"), ctx)
    right = resolve(expr.get("right"), ctx)
    return left == right


def expr_not(expr, ctx, resolve):
    arg = resolve(expr.get("arg"), ctx)
    return not bool(arg)


def expr_lookup(expr, ctx, resolve):
    source = resolve(expr.get("from"), ctx)
    if not isinstance(source, list):
        raise Exception("lookup source is not an array")
    match = expr.get("match", {})
    field = match.get("field")
    equals = resolve(match.get("equals"), ctx)
    select = expr.get("select")
    for item in source:
        if item.get(field) == equals:
            if select not in item:
                raise Exception("lookup select field not found")
            return item[select]
    raise Exception("lookup found no match")


EXPR_OPS = {
    "concat": expr_concat,
    "coalesce": expr_coalesce,
    "get": expr_get,
    "len": expr_len,
    "eq": expr_eq,
    "not": expr_not,
    "lookup": expr_lookup,
}
