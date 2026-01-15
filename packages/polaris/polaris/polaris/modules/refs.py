def get_path(path, ctx, state):
    parts = str(path).split(".")
    root = parts[0]
    rest = parts[1:]
    cur = None
    if root == "state":
        cur = state
    else:
        if root == "inputs":
            cur = state.get("inputs")
        else:
            if root == "run":
                cur = ctx.get("run")
            else:
                if root == "result":
                    cur = ctx.get("result")
                else:
                    cur = None
    for p in rest:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            cur = None
    return cur
