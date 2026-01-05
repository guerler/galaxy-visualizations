from polaris import Registry, Runner

async def run_agent(agent, config, transcripts):
    inputs = {
        "transcripts": transcripts,
    }
    print(config)
    print(transcripts)
    registry = Registry(config)
    runner = Runner(agent, registry)
    result = await runner.run(inputs)
    return result
