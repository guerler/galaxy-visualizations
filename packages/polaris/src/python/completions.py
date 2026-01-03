import json
import math
import aiohttp


MAX_TOKENS = 16384
TEMPERATURE = 0.3
TOP_P = 0.8


def normalize_parameter(value, min_val, max_val, fallback):
    if value is None:
        return fallback
    if value < min_val:
        return min_val
    if value > max_val:
        return max_val
    return value


async def completions_post(payload):
    base_url = payload["aiBaseUrl"].rstrip("/")
    url = f"{base_url}/chat/completions"

    body = {
        "model": payload["aiModel"],
        "messages": payload["messages"],
        "max_tokens": normalize_parameter(
            payload.get("aiMaxTokens"),
            1,
            math.inf,
            MAX_TOKENS,
        ),
        "temperature": normalize_parameter(
            payload.get("aiTemperature"),
            0,
            math.inf,
            TEMPERATURE,
        ),
        "top_p": normalize_parameter(
            payload.get("aiTopP"),
            float.fromhex("0x1p-52"),  # Number.EPSILON equivalent
            1,
            TOP_P,
        ),
    }

    tools = payload.get("tools")
    if tools:
        body["tools"] = tools

    tool_choice = payload.get("tool_choice")
    if tool_choice:
        body["tool_choice"] = tool_choice
    elif tools:
        first_tool = tools[0]
        tool_name = first_tool.get("function", {}).get("name")
        if not tool_name:
            raise Exception("Tool provided without function name")
        body["tool_choice"] = {
            "type": "function",
            "function": {"name": tool_name},
        }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {payload['aiApiKey']}",
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=body) as response:
            return await response.json()


def get_tool_call(name, tool_calls):
    result = {}
    found = False

    if tool_calls:
        for call in tool_calls:
            fn = call.get("function")
            if fn and fn.get("name") == name:
                found = True
                args = fn.get("arguments")
                if isinstance(args, str) and args:
                    try:
                        parsed = json.loads(args)
                        result.update(parsed)
                    except Exception:
                        continue

    return result if found else None
