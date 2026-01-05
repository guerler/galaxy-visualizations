from .modules.runner import Runner


async def run(inputs, config):
    runner = Runner(config)
    reply = await runner.run(inputs["transcripts"])
    print(reply)
    return "Welcome to VIntent"
