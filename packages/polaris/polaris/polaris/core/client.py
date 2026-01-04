import json


class HttpClient:
    async def request(self, method, url, headers=None, body=None):
        raise NotImplementedError


def is_pyodide():
    try:
        import pyodide_js  # noqa: F401
        return True
    except Exception:
        return False


# ----------------------------
# Browser / Pyodide client
# ----------------------------

class BrowserHttpClient(HttpClient):
    def __init__(self):
        from js import fetch
        from pyodide.ffi import to_js

        self._fetch = fetch
        self._to_js = to_js

    async def request(self, method, url, headers=None, body=None):
        options = {
            "method": method.upper(),
            "headers": headers or {},
        }
        if body is not None:
            options["body"] = json.dumps(body)

        response = await self._fetch(url, self._to_js(options))
        if not response.ok:
            text = await response.text()
            raise Exception(f"HTTP {response.status}: {text}")

        text = await response.text()
        try:
            return json.loads(text)
        except Exception:
            return text


# ----------------------------
# Server / Backend client
# ----------------------------

class ServerHttpClient(HttpClient):
    def __init__(self):
        import aiohttp
        self._aiohttp = aiohttp

    async def request(self, method, url, headers=None, body=None):
        async with self._aiohttp.ClientSession() as session:
            data = None
            if body is not None:
                data = json.dumps(body)
                headers = headers or {}
                headers.setdefault("Content-Type", "application/json")

            async with session.request(
                method=method.upper(),
                url=url,
                headers=headers,
                data=data,
            ) as response:
                if response.status >= 400:
                    text = await response.text()
                    raise Exception(f"HTTP {response.status}: {text}")

                text = await response.text()
                try:
                    return json.loads(text)
                except Exception:
                    return text


# ----------------------------
# Export single implementation
# ----------------------------

if is_pyodide():
    http = BrowserHttpClient()
else:
    http = ServerHttpClient()


__all__ = ["http", "HttpClient"]
