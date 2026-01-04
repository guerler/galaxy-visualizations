from .registry import Registry
from .runner import Runner


async def run(agent, inputs, config):
    registry = Registry(config)
    await registry.init()
    runner = Runner(agent, registry)
    result = await runner.run(inputs)
    return result
