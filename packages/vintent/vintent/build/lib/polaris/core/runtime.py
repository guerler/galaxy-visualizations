from .registry import Registry
from .runner import Runner


async def run(name, agents, inputs, config):
    registry = Registry(config)
    await registry.init()
    registry.agents.register_agents(agents)
    agent = registry.agents.resolve_agent(name)
    runner = Runner(agent, registry)
    result = await runner.run(inputs)
    return result
