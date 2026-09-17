function parseJson(text) {
  const source = String(text || '').trim();
  try { return JSON.parse(source); } catch {}
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(source);
  if (fenced) return JSON.parse(fenced[1]);
  const start = source.indexOf('{'), end = source.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(source.slice(start, end + 1));
  throw new Error('Local DT model did not return a valid action plan');
}

class PromptRuntime {
  constructor({ skillRegistry, capabilityBus, localIntelligence, executeSkill, vault }) {
    this.skills = skillRegistry;
    this.tools = capabilityBus;
    this.local = localIntelligence;
    this.executeSkill = executeSkill;
    this.vault = vault;
  }

  async deterministicMatch(prompt, input, runtime) {
    const text = String(prompt || '').trim();
    const toolMatch = /^\/tool\s+(\S+)(?:\s+([\s\S]+))?$/i.exec(text);
    if (toolMatch) {
      const toolId = toolMatch[1];
      const toolInput = toolMatch[2] ? parseJson(toolMatch[2]) : input;
      if (!this.tools.has(toolId)) throw new Error('Unknown DT tool: ' + toolId);
      return { mode: 'tool', routedBy: 'DIRECT_LOCAL_TOOL', toolId,
        result: await this.tools.call(toolId, toolInput || {}, runtime) };
    }
    const psMatch = /^\/ps\s+([\s\S]+)$/i.exec(text);
    if (psMatch) return { mode: 'tool', routedBy: 'DIRECT_LOCAL_TOOL', toolId: 'powershell.run',
      result: await this.tools.call('powershell.run', { command: psMatch[1] }, runtime) };
    if (/google\s+drive.*(?:root|where|detect|find)|(?:where|find|detect).*google\s+drive/i.test(text)) {
      return { mode: 'tool', routedBy: 'BUILTIN_LOCAL_INTENT', toolId: 'google_drive.roots',
        result: await this.tools.call('google_drive.roots', {}, runtime) };
    }
    if (/runtime\s+status|worker\s+status/i.test(text)) return {
      mode: 'tool', routedBy: 'BUILTIN_LOCAL_INTENT', toolId: 'runtime.status',
      result: await this.tools.call('runtime.status', {}, runtime)
    };
    const matches = this.skills.match(text);
    if (!matches.length) return null;
    const top = matches[0];
    const result = await this.executeSkill(top.skill, input, runtime);
    return { mode: 'skill', routedBy: 'DETERMINISTIC_TRIGGER', skill: top.skill, result };
  }

  plannerSystem() {
    const skills = this.skills.list().filter(skill => skill.state === 'PROMOTED')
      .map(skill => ({ id: skill.id, name: skill.name, description: skill.description, inputs: skill.inputs }));
    const tools = this.tools.list().map(tool => ({
      id: tool.id, description: tool.description, inputSchema: tool.inputSchema,
      risk: tool.risk, requiresOwnerApproval: tool.requiresOwnerApproval
    }));
    return [
      'You are the resident DT local planner. Route the user request to local DT capabilities.',
      'Return JSON only with one mode: skill, tool, answer, or clarify.',
      'For skill: {"mode":"skill","skillId":"...","input":{}}.',
      'For tool: {"mode":"tool","toolId":"...","input":{}}.',
      'For answer: {"mode":"answer","text":"..."}.',
      'Never invent skill IDs or tool IDs. Never request a remote AI.',
      'Available skills: ' + JSON.stringify(skills),
      'Available tools: ' + JSON.stringify(tools)
    ].join('\n');
  }

  async modelPlan(prompt) {
    const status = await this.local.status();
    if (!status.available) return { available: false, status };
    const text = await this.local.complete({ system: this.plannerSystem(), prompt });
    return { available: true, status, plan: parseJson(text), raw: text };
  }

  async handle({ prompt, input = {}, runtime = {} }) {
    const text = String(prompt || '').trim();
    if (!text) throw new Error('Prompt required');
    const deterministic = await this.deterministicMatch(text, input, runtime);
    if (deterministic) return this.record(text, deterministic);
    const planned = await this.modelPlan(text);
    if (!planned.available) {
      return this.record(text, {
        mode: 'no-route', routedBy: 'LOCAL_ONLY',
        message: 'No promoted local skill matched and the DT local model host is offline.',
        localModel: planned.status
      });
    }
    const plan = planned.plan || {};
    if (plan.mode === 'skill') {
      const skill = this.skills.load(plan.skillId);
      if (!skill || skill.state !== 'PROMOTED') throw new Error('DT local model selected an unavailable skill');
      return this.record(text, { mode: 'skill', routedBy: 'DT_LOCAL_MODEL', skill,
        result: await this.executeSkill(skill, plan.input || {}, runtime) });
    }
    if (plan.mode === 'tool') {
      if (!this.tools.has(plan.toolId)) throw new Error('DT local model selected an unavailable tool');
      return this.record(text, { mode: 'tool', routedBy: 'DT_LOCAL_MODEL', toolId: plan.toolId,
        result: await this.tools.call(plan.toolId, plan.input || {}, runtime) });
    }
    return this.record(text, { mode: plan.mode || 'answer', routedBy: 'DT_LOCAL_MODEL',
      text: String(plan.text || plan.question || planned.raw || '') });
  }

  record(prompt, result) {
    this.vault?.append('prompt-runtime', 'dt-prompt', {
      prompt, mode: result.mode, routedBy: result.routedBy || null,
      requiresRemoteAI: false,
      skillId: result.skill?.id || null,
      toolId: result.toolId || null,
      completedAt: new Date().toISOString()
    });
    return result;
  }
}

module.exports = { PromptRuntime, parseJson };
