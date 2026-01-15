from polaris.modules.registry import Registry
from polaris.modules.runner import Runner


async def run(config, inputs, name, agents):
    registry = Registry(config)
    await registry.init()
    registry.agents.register_agents(agents)
    agent = registry.agents.resolve_agent(name)
    runner = Runner(agent, registry)
    result = await runner.run(inputs)
    return result
