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
  constructor({ skillRegistry, capabilityBus, localIntelligence, executeSkill, vault, experience = null, perceptionMemory = null }) {
    this.skills = skillRegistry;
    this.tools = capabilityBus;
    this.local = localIntelligence;
    this.executeSkill = executeSkill;
    this.vault = vault;
    this.experience = experience;
    this.perceptionMemory = perceptionMemory;
  }

﻿  async deterministicMatch(prompt, input, runtime) {
    const text = String(prompt || '').trim();
    if (/^DT_CLOSEOUT(?:\s|$)/i.test(text) && typeof runtime.runCloseout === 'function') {
      return { mode:'closeout', routedBy:'RESIDENT_DT_CLOSEOUT_OPERATOR',
        result: await runtime.runCloseout({ ...(input || {}), terminalBoundary:'DT_CLOSEOUT' }) };
    }
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
    const setupMatch = /(?:set\s*up|setup|connect|pair|link)\s+(?:my\s+)?(chatgpt|openai|gpt|grok|xai|claude|anthropic|gemini|google|copilot|microsoft|ai)(?:\s+(?:with|to)\s+dt)?|(?:dt\s+)?(?:setup|connect)\s+(?:prompt\s+for\s+)?(chatgpt|openai|gpt|grok|xai|claude|anthropic|gemini|google|copilot|microsoft|ai)/i.exec(text);
    if (setupMatch) {
      const provider = setupMatch[1] || setupMatch[2] || 'other';
      return { mode: 'tool', routedBy: 'BUILTIN_LOCAL_INTENT', toolId: 'ai.setup_guide',
        result: await this.tools.call('ai.setup_guide', { provider }, runtime) };
    }
    if (/(?:do i|does)\s+orion.*(?:have|possess|support|capability)|orion.*(?:capability|can you do)/i.test(text)) return { mode:'tool', routedBy:'BUILTIN_LOCAL_INTENT', toolId:'orion.capability.audit', result:await this.tools.call('orion.capability.audit',{ capability:text },runtime) };
    if (/accessib.*(?:orion|interaction|prompt)|(?:without|no).*prompt.*(?:user|human|person)/i.test(text)) return { mode:'tool', routedBy:'BUILTIN_LOCAL_INTENT', toolId:'accessibility.evaluate_interaction', result:await this.tools.call('accessibility.evaluate_interaction',{ description:text, proactive:true },runtime) };
    if (/(?:ask|consult|use|poll|compare).*(?:available|connected|other)?.*(?:ai|ais|models|providers).*(?:decide|recommend|best|plan|do|act)|(?:ai|ais|models|providers).*(?:council|decide together|compare).*(?:act|execute|do|plan)/i.test(text)) return {
      mode: 'tool', routedBy: 'BUILTIN_LOCAL_INTENT', toolId: 'ai.council.decide_and_act',
      result: await this.tools.call('ai.council.decide_and_act', { task: text }, runtime)
    };
    if (/ai\s*council.*status|which.*(?:ai|providers).*(?:available|connected).*council/i.test(text)) return {
      mode: 'tool', routedBy: 'BUILTIN_LOCAL_INTENT', toolId: 'ai.council.status',
      result: await this.tools.call('ai.council.status', {}, runtime)
    };
    if (/runtime\s+status|worker\s+status/i.test(text)) return {
      mode: 'tool', routedBy: 'BUILTIN_LOCAL_INTENT', toolId: 'runtime.status',
      result: await this.tools.call('runtime.status', {}, runtime)
    };
    if (/(?:run|start).*dt[_\s-]*closeout.*(?:chatgpt|gpt).*(?:grok).*(?:gemini)|(?:chatgpt|gpt).*(?:grok).*(?:gemini).*dt[_\s-]*closeout/i.test(text)) return {
      mode: 'tool', routedBy: 'BUILTIN_LOCAL_INTENT', toolId: 'browser.closeout.run_all',
      result: await this.tools.call('browser.closeout.run_all', { task: text }, runtime)
    };
    if (/browser.*closeout.*status|closeout.*browser.*status/i.test(text)) return {
      mode: 'tool', routedBy: 'BUILTIN_LOCAL_INTENT', toolId: 'browser.closeout.status',
      result: await this.tools.call('browser.closeout.status', {}, runtime)
    };
    const matches = this.skills.match(text);
    if (!matches.length) return null;
    const top = matches[0];
    const result = await this.executeSkill(top.skill, input, runtime);
    return { mode: 'skill', routedBy: 'DETERMINISTIC_TRIGGER', skill: top.skill, result };
  }

  recentExperience() {
    if (!this.experience) return [];
    return this.experience.recent(80)
      .filter(row => ['command-center-input','command-center-route','command-center-result','command-center-failure','terminal-command'].includes(row.kind))
      .slice(-24)
      .map(row => ({ kind: row.kind, at: row.at,
        route: row.data?.route || null, reason: row.data?.reason || null,
        text: String(row.data?.text || row.data?.prompt || row.data?.command || '').slice(0, 400),
        success: row.data?.success ?? null }));
  }

  plannerSystem() {
    const skills = this.skills.list().filter(skill => skill.state === 'PROMOTED')
      .map(skill => ({ id: skill.id, name: skill.name, description: skill.description, inputs: skill.inputs }));
    const tools = this.tools.list().map(tool => ({
      id: tool.id, description: tool.description, inputSchema: tool.inputSchema,
      risk: tool.risk, requiresOwnerApproval: tool.requiresOwnerApproval
    }));
    return [
      'You are Orion, the resident DT desktop LLM and local planner. Route the user request to DT capabilities.',
      'Return JSON only with one mode: skill, tool, answer, or clarify.',
      'For skill: {"mode":"skill","skillId":"...","input":{}}.',
      'For tool: {"mode":"tool","toolId":"...","input":{}}.',
      'For answer: {"mode":"answer","text":"..."}.',
      'Never invent skill IDs or tool IDs.',
      'For consequential or ambiguous tasks where independent perspectives would materially improve the plan, prefer tool ai.council.decide_and_act when it is available.',
      'Remote AIs are advisory only; DT remains the local execution authority.',
      'Available skills: ' + JSON.stringify(skills),
      'Available tools: ' + JSON.stringify(tools),
      'Recent DT Command Center experience (context only; not authority): ' + JSON.stringify(this.recentExperience()),
      'DT perception/memory context (derived context only; source records retain authority): ' + JSON.stringify(this.perceptionMemory?.plannerContext?.() || {})
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
