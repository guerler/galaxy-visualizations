import argparse
import asyncio
import os
import pathlib

import yaml

import polaris

env = {
    "AI_API_KEY": None,
    # "AI_BASE_URL": "http://localhost:11434/v1",
    "AI_BASE_URL": "http://localhost:8080/api/plugins/vintent",
    "AI_MODEL": None,
    "GALAXY_KEY": None,
    "GALAXY_ROOT": "http://localhost:8080/",
}

for key in env:
    env[key] = os.environ.get(key) or env[key]

if env["GALAXY_KEY"] is None:
    raise Exception("GALAXY_KEY missing in environment.")

config = {
    "ai_api_key": env["AI_API_KEY"] or env["GALAXY_KEY"],
    "ai_base_url": env["AI_BASE_URL"],
    "ai_model": env["AI_MODEL"],
    "galaxy_root": env["GALAXY_ROOT"],
    "galaxy_key": env["GALAXY_KEY"],
}

MESSAGE_INITIAL = "Hi, I can a pick a tool for you."
MESSAGE_USER = "Open the aminos history"
PROMPT_DEFAULT = "Choose and parameterize one of the provided tools. YOU MUST choose a tool!"


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
    run.add_argument("--query", required=False, default=MESSAGE_USER)
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
