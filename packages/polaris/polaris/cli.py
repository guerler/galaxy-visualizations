import argparse

def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run")
    sub.add_parser("test")
    args = parser.parse_args()
    if args.cmd == "run":
        print("run")
    else:
        print("not run")
