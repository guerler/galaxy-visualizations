import argparse
import asyncio
import os

import vintent

env = {
    "AI_API_KEY": "None",
    "AI_BASE_URL": "http://localhost:11434/v1",
    "AI_MODEL": "qwen3:8b",
    "GALAXY_KEY": None,
    "GALAXY_ROOT": "http://localhost:8080/",
}

for key in env:
    env[key] = os.environ.get(key) or env[key]

if env["GALAXY_KEY"] is None:
    raise Exception("GALAXY_KEY missing in environment.")

config = {
    "ai_api_key": env["AI_API_KEY"],
    "ai_base_url": env["AI_BASE_URL"],
    "ai_model": env["AI_MODEL"],
    "galaxy_root": env["GALAXY_ROOT"],
    "galaxy_key": env["GALAXY_KEY"],
}

MESSAGE_INITIAL = "Hi, I can a pick a tool for you."
MESSAGE_USER = "Create a correlation plot"
PROMPT_DEFAULT = "Choose and parameterize one of the provided tools. YOU MUST choose a tool!"


async def main_async():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    run = sub.add_parser("run")
    run.add_argument("--query", required=False, default=MESSAGE_USER)
    args = parser.parse_args()
    if args.cmd == "run":
        inputs = {
            "transcripts": [
                {"content": PROMPT_DEFAULT, "role": "system"},
                {"content": MESSAGE_INITIAL, "role": "assistant"},
                {"content": args.query or MESSAGE_USER, "role": "user"},
            ]
        }
        reply = await vintent.run("../test-data/dataset.csv", inputs, config)
        print(reply)
    else:
        print("Unknown command:", args.cmd)


def main():
    asyncio.run(main_async())
