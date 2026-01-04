import argparse
import yaml

from pathlib import Path
from .cli_run import run_agent

config = {
    "aiBaseUrl": "http://localhost:11434/v1/",
    "aiApiKey": "unknown",
    "aiModel": "unknown",
}

def load_default_agent():
    path = Path(__file__).parent / "agents" / "default.yml"
    with path.open("r") as f:
        return yaml.safe_load(f)

def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run")
    sub.add_parser("test")
    args = parser.parse_args()
    if args.cmd == "run":
        agent = load_default_agent()
        run_agent(agent, config, [{ "content": "Pick aminos.", "role": "user" }])
    else:
        print("not run")
