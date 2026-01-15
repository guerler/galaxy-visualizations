import json

from jsonschema import Draft7Validator

from .agents import Agents
from .api.api import API_METHODS
from .api.catalog import load_providers
from polaris.core.completions import completions_post, get_tool_call


# ----------------------------
# Registry
# ----------------------------
class Registry:
    def __init__(self, config):
        self.config = config
        self.capabilities = ["llm", "galaxy.read"]
        self.agents = Agents()
        self.api_targets = {}
        self.api_ops = {}

    async def init(self):
        self.providers = await load_providers(self.config)
        for provider in self.providers:
            # register target
            target = provider.target()
            target_name = target.name
            if target_name in self.api_targets:
                raise Exception(f"API target already registered: {target_name}")
            self.api_targets[target_name] = target
            # register ops
            for name, op in provider.ops().items():
                if name in self.api_ops:
                    raise Exception(f"API op already registered: {name}")
                if op.target not in self.api_targets:
                    raise Exception(f"API op '{name}' references unknown target '{op.target}'")
                self.api_ops[name] = op

    # ----------------------------
    # Tool Builder
    # ----------------------------
    def build_route_tool(self, ctx, node, output_schema=None):
        if output_schema and output_schema.get("properties", {}).get("next", {}).get("enum"):
            next_enum = output_schema["properties"]["next"]["enum"]
        else:
            next_enum = list(ctx["graph"]["nodes"].keys())
        properties = {
            "next": {
                "type": "string",
                "enum": next_enum,
            }
        }
        required = {"next"}
        enum_from = node.get("enum_from")
        if enum_from and output_schema and isinstance(output_schema.get("required"), list):
            src = ctx["state"].get(enum_from["state"])
            if not isinstance(src, list):
                raise Exception(f"enum_from source is not an array: {enum_from['state']}")
            values = src
            filt = enum_from.get("filter")
            if filt:
                values = [v for v in values if v.get(filt["field"]) == filt["equals"]]
            enum_values = [v.get(enum_from["field"]) for v in values if isinstance(v.get(enum_from["field"]), str)]
            field = next(k for k in output_schema["required"] if k != "next")
            if not enum_values:
                raise Exception(f"No valid enum values for field '{field}' from state '{enum_from['state']}'")
            properties[field] = {
                "type": "string",
                "enum": enum_values,
            }
            required.add(field)
        return [
            {
                "type": "function",
                "function": {
                    "name": "route",
                    "description": "Select the next node and required identifiers.",
                    "parameters": {
                        "type": "object",
                        "required": list(required),
                        "properties": properties,
                        "additionalProperties": False,
                    },
                },
            }
        ]

    # ----------------------------
    # API dispatch
    # ----------------------------
    async def call_api(self, ctx, spec):
        op = self.api_ops.get(spec["target"])
        if not op:
            for provider in self.providers:
                op = provider.resolve_op(spec["target"])
                if op:
                    break
        if not op:
            return {
                "ok": False,
                "error": {
                    "code": "unknown_api_op",
                    "message": spec["target"],
                },
            }
        method = op.meta.get("method")
        if not method or method.lower() != API_METHODS.GET:
            return {
                "ok": False,
                "error": {
                    "code": "method_not_allowed",
                    "method": method,
                },
            }
        if op.capability and op.capability not in self.capabilities:
            return {
                "ok": False,
                "error": {
                    "code": "forbidden",
                    "message": spec["target"],
                },
            }
        target = self.api_targets[op.target]
        try:
            result = await op.handler(target, spec.get("input", {}), op.meta)
            return {"ok": True, "result": result}
        except Exception as e:
            return {
                "ok": False,
                "error": {
                    "code": "api_call_failed",
                    "message": str(e),
                },
            }

    # ----------------------------
    # Planner
    # ----------------------------
    async def plan(self, ctx, spec):
        system_prompt = spec.get(
            "prompt",
            "You are a routing component. You MUST call the provided tool. Do not respond with text.",
        )
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(self.sanitize(ctx["inputs"].get("transcripts")))
        tools = self.build_route_tool(ctx, spec["node"], spec.get("output_schema"))
        tool_name = tools[0]["function"]["name"]
        reply = await completions_post(
            {
                **self.config,
                "messages": messages,
                "tools": tools,
                "tool_choice": {
                    "type": "function",
                    "function": {"name": tool_name},
                },
            }
        )
        choice = reply.get("choices", [{}])[0]
        arguments = get_tool_call(tool_name, reply)
        if not arguments:
            raise Exception(
                "planner did not produce tool call; "
                f"model={reply.get('model')}; "
                f"finish_reason={choice.get('finish_reason')}; "
                f"message={choice.get('message')}"
            )
        if spec.get("output_schema"):
            validator = Draft7Validator(spec["output_schema"])
            errors = list(validator.iter_errors(arguments))
            if errors:
                raise Exception("planner output schema violation: " + "; ".join(e.message for e in errors))
        return arguments

    # ----------------------------
    # Reason
    # ----------------------------
    async def reason(self, prompt, input):
        messages = [
            {
                "role": "user",
                "content": (
                    prompt
                    + "\n\n"
                    + "Respond with TEXT ONLY.\n"
                    + "Do not include JSON, markdown, or structured data.\n"
                    + "Do not include explanations about your reasoning process."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(input),
            },
        ]
        reply = await completions_post(
            {
                **self.config,
                "messages": messages,
            }
        )
        content = reply["choices"][0]["message"]["content"]
        if not content:
            raise Exception("reasoning node produced empty output")
        return content

    # ----------------------------
    # Sanitization
    # ----------------------------
    def sanitize(self, transcripts):
        if not isinstance(transcripts, list):
            return []
        out = []
        for t in transcripts:
            content = t.get("content")
            if isinstance(content, str) and content:
                out.append({"role": t.get("role"), "content": content})
        return out
