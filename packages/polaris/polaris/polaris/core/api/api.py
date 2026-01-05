from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional


class API_METHODS:
    GET = "get"
    POST = "post"
    PUT = "put"
    DELETE = "delete"


@dataclass
class ApiOp:
    target: str
    handler: Callable
    capability: Optional[str] = None
    meta: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ApiTarget:
    name: str
    base_url: str
    auth: Optional[Callable[[str], str]] = None

    def build_url(self, path: str) -> str:
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        if self.auth:
            url = self.auth(url)
        return url


class ApiProvider:
    def target(self):
        raise NotImplementedError

    def ops(self):
        return {}

    def resolve_op(self, name):
        return None
