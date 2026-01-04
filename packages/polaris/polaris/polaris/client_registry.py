from jsonschema import Draft7Validator
import json


class ClientRegistry:
    def __init__(self, ai_config):
        self.ai_config = ai_config
        self.capabilities = ["llm", "galaxy.read"]
        self.api_targets = {
            "galaxy.history.list": self._history_list,
            "galaxy.history.contents": self._history_contents,
            "galaxy.dataset.show": self._dataset_show,
        }

    # ---------- Planner ----------

    async def plan(self, ctx, spec):
        system_prompt = spec.get(
            "prompt",
            "You are a routing component. You MUST call the provided tool. Do not respond with text."
        )

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(self.sanitize(ctx["inputs"].get("transcripts")))

        tools = self.build_route_tool(ctx, spec["node"], spec.get("outputSchema"))
        tool_name = tools[0]["function"]["name"]

        reply = await completions_post({
            **self.ai_config,
            "messages": messages,
            "tools": tools,
            "tool_choice": {
                "type": "function",
                "function": {"name": tool_name},
            },
        })

        call = get_tool_call(
            tool_name,
            reply.get("choices", [{}])[0]
                .get("message", {})
                .get("tool_calls")
        )

        if not call:
            raise Exception("planner did not produce tool call")

        arguments = call["function"]["arguments"]
        if isinstance(arguments, str):
            arguments = json.loads(arguments)

        if spec.get("outputSchema"):
            validator = Draft7Validator(spec["outputSchema"])
            errors = list(validator.iter_errors(arguments))
            if errors:
                raise Exception(
                    "planner output schema violation: "
                    + "; ".join(e.message for e in errors)
                )

        return arguments

    # ---------- API Calls ----------

    async def call_api(self, ctx, spec):
        fn = self.api_targets.get(spec["target"])
        if not fn:
            return {
                "ok": False,
                "error": {
                    "code": "unknown_api_target",
                    "message": spec["target"],
                },
            }
        try:
            result = await fn(spec.get("input", {}))
            return {"ok": True, "result": result}
        except Exception as e:
            return {
                "ok": False,
                "error": {
                    "code": "api_call_failed",
                    "message": str(e),
                },
            }

    # ---------- Sanitization ----------

    def sanitize(self, transcripts):
        if not isinstance(transcripts, list):
            return []
        out = []
        for t in transcripts:
            content = t.get("content")
            if isinstance(content, str) and content:
                out.append({"role": t.get("role"), "content": content})
        return out

    # ---------- Tool Builder ----------

    def build_route_tool(self, ctx, node, output_schema=None):
        if (
            output_schema
            and output_schema.get("properties", {}).get("next", {}).get("enum")
        ):
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
                raise Exception(
                    f"enum_from source is not an array: {enum_from['state']}"
                )

            values = src
            filt = enum_from.get("filter")
            if filt:
                values = [
                    v for v in values
                    if v.get(filt["field"]) == filt["equals"]
                ]

            enum_values = [
                v.get(enum_from["field"])
                for v in values
                if isinstance(v.get(enum_from["field"]), str)
            ]

            field = next(k for k in output_schema["required"] if k != "next")

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

    # ---------- Galaxy API stubs ----------

    async def _history_list(self, input):
        limit = input.get("limit")
        params = f"?limit={limit}" if limit else ""
        res = await fetch(f"/api/histories{params}")
        return await res.json()

    async def _history_contents(self, input):
        history_id = input["history_id"]
        res = await fetch(f"/api/histories/{history_id}/contents")
        return await res.json()

    async def _dataset_show(self, input):
        dataset_id = input.get("dataset_id")
        if not dataset_id:
            raise Exception("dataset_id missing")
        res = await fetch(f"/api/datasets/{dataset_id}")
        return await res.json()
