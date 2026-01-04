from polaris import Registry, Runner

async def run_agent(agent, config, transcripts):
    payload = {
        "graph": agent,
        "inputs": {
            "transcripts": transcripts,
        },
    }
    registry = Registry(config)
    runner = Runner(payload["graph"], registry)
    result = await runner.run(payload["inputs"])
    return result
