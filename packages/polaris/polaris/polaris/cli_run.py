import json
from pathlib import Path
import yaml
from polaris import Registry, Runner

def load_default_agent():
    path = Path(__file__).parent / "agents" / "default.yml"
    with path.open("r") as f:
        return yaml.safe_load(f)

async def run_agent(config, transcripts):
    agent = load_default_agent()
    payload = {
        "graph": agent,
        "inputs": {
            "transcripts": transcripts,
        },
    }
    registry = Registry(config)
    runner = Runner(payload["graph"], registry)
    result = await runner.run(payload["inputs"])
    return result
