class AgentRegistry {
  constructor(agents = []) { this.agents = new Map(agents.map(agent => [agent.id, Object.freeze(agent)])); }
  get(id) { return this.agents.get(id); }
  list() { return [...this.agents.values()]; }
  register(agent) {
    if (!agent.id || this.agents.has(agent.id)) throw new Error('Agent ID must be unique');
    this.agents.set(agent.id, Object.freeze(agent));
    return agent;
  }
}
module.exports = { AgentRegistry };
