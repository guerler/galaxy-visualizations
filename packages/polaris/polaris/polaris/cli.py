import argparse
import asyncio
import yaml
from pathlib import Path
from .cli_run import run_agent

config = {
    "aiBaseUrl": "http://localhost:11434/v1",
    "aiApiKey": "unknown",
    "aiModel": "unknown",
    "galaxyRoot": "http://127.0.0.1:8080/",
    "galaxyKey": "0d913a5539f108e4a7d695d434828708",
}

MESSAGE_INITIAL = "Hi, I can a pick a tool for you.";
PROMPT_DEFAULT = "How can I help you?";

def load_agent(path):
    p = Path(path)
    with p.open("r") as f:
        return yaml.safe_load(f)

async def main_async():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    run = sub.add_parser("run")
    run.add_argument("--agent", required=True)
    sub.add_parser("test")
    args = parser.parse_args()
    if args.cmd == "run":
        agent = load_agent(args.agent)
        await run_agent(agent, config, [
            {"content": PROMPT_DEFAULT, "role": "system"},
            {"content": MESSAGE_INITIAL, "role": "assistant"},
            {"content": "Pick genetics.", "role": "user"}])
    else:
        print("Unknown command:", args.cmd)

def main():
    asyncio.run(main_async())
