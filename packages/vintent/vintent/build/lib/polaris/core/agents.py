class Agents:
    def __init__(self):
        self.agents = {}

    def register_agent(self, agent_id, agent):
        if agent_id in self.agents:
            raise Exception(f"Agent already registered: {agent_id}")
        self.agents[agent_id] = agent

    def register_agents(self, agents):
        for agent_id, agent in agents.items():
            self.register_agent(agent_id, agent)

    def resolve_agent(self, agent_id):
        agent = self.agents.get(agent_id)
        if not agent:
            raise Exception(f"Unknown agent: {agent_id}")
        return agent
