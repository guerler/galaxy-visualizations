import pytest

from polaris.core.runtime import run


@pytest.mark.asyncio
async def test_run_minimal_agent(monkeypatch):
    async def fake_completions_post(payload):
        return {
            "choices": [
                {
                    "message": {
                        "tool_calls": [
                            {
                                "function": {
                                    "name": "route",
                                    "arguments": '{"next": "end"}',
                                }
                            }
                        ]
                    }
                }
            ]
        }

    monkeypatch.setattr(
        "polaris.core.registry.completions_post",
        fake_completions_post,
    )

    agent = {
        "nodes": {
            "start": {
                "type": "planner",
                "next": None,
            }
        },
        "start": "start",
    }

    inputs = {"transcripts": []}
    config = {
        "ai_base_url": "http://example.org",
        "ai_model": "test",
        "ai_api_key": "test",
    }

    result = await run(agent, inputs, config)

    assert result["last"]["result"]["next"] == "end"
    assert result["last"]["ok"] is True
