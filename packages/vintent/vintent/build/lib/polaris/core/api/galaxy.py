from ..client import http
from .api import API_METHODS, ApiOp, ApiProvider, ApiTarget
from .generic import openapi_get
from .openapi import OpenApiCatalog

ALLOWED_METHODS = [API_METHODS.GET]
PROVIDER_NAME = "galaxy"
PREFIXES = ["/api/histories", "/api/datasets"]


class GalaxyApi(ApiProvider):
    def __init__(self, config):
        self.galaxy_root = config.get("galaxy_root")
        if not self.galaxy_root:
            raise Exception("galaxy_root missing")

        self.galaxy_key = config.get("galaxy_key")
        self.openapi = None

    async def init(self):
        try:
            spec = await http.request("GET", f"{self.galaxy_root}openapi.json")
            self.openapi = OpenApiCatalog(
                spec=spec,
                prefixes=PREFIXES,
                methods=ALLOWED_METHODS,
            )
        except Exception as e:
            raise Exception(f"Failed to process OpenAPI schema: {e}.")
        return self

    def target(self):
        return ApiTarget(
            name=PROVIDER_NAME,
            base_url=self.galaxy_root,
            auth=self._galaxy_auth,
        )

    def ops(self):
        return {}

        # Disabled demonstration of a custom op
        async def _example_handler(self, target, input, meta=None):
            limit = input.get("limit")
            params = f"?limit={limit}" if limit else ""
            url = target.build_url(f"api/histories{params}")
            return await http.request("GET", url)

        return {
            "galaxy.example": ApiOp(
                target="galaxy",
                handler=_example_handler,
                capability="galaxy.read",
            ),
        }

    def resolve_op(self, name):
        prefix = f"{PROVIDER_NAME}."
        if not name.startswith(prefix):
            return None
        local = name[len(prefix) :]
        resolved = self.openapi.get_op(local)
        if not resolved:
            return None
        path, operation, method = resolved
        return ApiOp(
            target="galaxy",
            handler=openapi_get,
            capability="galaxy.read",
            meta={
                "path": path,
                "operation": operation,
                "method": method,
            },
        )

    def _galaxy_auth(self, url):
        if self.galaxy_key:
            sep = "&" if "?" in url else "?"
            return f"{url}{sep}key={self.galaxy_key}"
        return url
