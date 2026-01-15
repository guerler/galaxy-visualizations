import argparse
import asyncio
import os
import pathlib

import yaml

from .config import MESSAGE_INITIAL, PROMPT_DEFAULT, config

import polaris


def load_agents_from_dir(path):
    agents = {}
    base = pathlib.Path(path)
    for p in base.glob("*.yml"):
        agent_id = p.stem
        with p.open("r") as f:
            agents[agent_id] = yaml.safe_load(f)
    return agents


async def main_async():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    run = sub.add_parser("run")
    run.add_argument("--agent", required=True)
    run.add_argument("--query", required=False, default=PROMPT_DEFAULT)
    args = parser.parse_args()
    if args.cmd == "run":
        agents = load_agents_from_dir("./agents")
        inputs = {
            "transcripts": [
                {"content": PROMPT_DEFAULT, "role": "system"},
                {"content": MESSAGE_INITIAL, "role": "assistant"},
                {"content": args.query, "role": "user"},
            ]
        }
        reply = await polaris.run(config, inputs, args.agent, agents)
        print(reply["last"])

    else:
        print("Unknown command:", args.cmd)


def main():
    asyncio.run(main_async())
