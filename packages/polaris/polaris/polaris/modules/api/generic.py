from polaris.core.client import http


async def openapi_get(target, input, meta):
    path = meta["path"]
    for k, v in input.items():
        path = path.replace(f"{{{k}}}", str(v))
    url = target.build_url(path)
    return await http.request("GET", url)
