from urllib.parse import urlencode

from polaris.core.client import http


async def openapi_get(target, input, meta):
    path = meta["path"]
    query_params = {}

    for k, v in input.items():
        placeholder = f"{{{k}}}"
        if placeholder in path:
            # Path parameter - substitute in URL
            path = path.replace(placeholder, str(v))
        else:
            # Query parameter - add to query string
            query_params[k] = v

    url = target.build_url(path)

    # Append query parameters if any
    if query_params:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}{urlencode(query_params)}"

    return await http.request("GET", url)
