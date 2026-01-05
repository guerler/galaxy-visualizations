from .modules.runner import Runner


async def run(file_name, inputs, config):
    runner = Runner(config)
    reply = await runner.run(file_name, inputs["transcripts"])
    return reply
