class OpenApiCatalog:
    def __init__(self, spec, prefixes, methods=None, prefixture="api", placeholder="show"):
        self.index = {}
        self.methods = methods or ["get"]
        self.placeholder = placeholder
        self.prefixture = prefixture
        self.spec = spec
        for path, ops in spec.get("paths", {}).items():
            if not path.startswith(tuple(prefixes)):
                continue
            for method in methods:
                if method not in ops:
                    continue
                name = self._name_from_path(path) + f".{method}"
                self.index[name] = (path, ops[method], method)
        print(f"[polaris] OpenApiCatalog entries: {len(self.index.keys())}.")

    def _name_from_path(self, path):
        parts = path.strip("/").split("/")
        if parts and parts[0] == self.prefixture:
            parts = parts[1:]
        out = []
        for p in parts:
            if p.startswith("{"):
                out.append(self.placeholder)
            else:
                out.append(p)
        return ".".join(out)

    def get_op(self, name):
        return self.index.get(name)
