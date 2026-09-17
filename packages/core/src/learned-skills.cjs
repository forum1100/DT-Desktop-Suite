const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { commandRisk } = require('./grok-command.cjs');

const SCHEMA = 'dt-learned-skill/1.0';
const STEP_TYPES = Object.freeze(['agent.run', 'workflow.execute', 'tool.call', 'command.run']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort()
    .reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function extractJson(text) {
  const source = String(text || '').trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(source);
  const candidate = fenced ? fenced[1].trim() : source;
  try { return JSON.parse(candidate); } catch {}
  const start = candidate.indexOf('{'), end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
  throw new Error('AI lesson did not contain a valid JSON skill');
}

function normalizeStep(step, index, knownAgents, knownTools = new Set()) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) throw new Error(`Step ${index + 1} must be an object`);
  const type = String(step.type || '').trim();
  if (!STEP_TYPES.includes(type)) throw new Error(`Step ${index + 1} has unsupported type ${type || '(missing)'}`);
  if (type === 'agent.run') {
    const agentId = String(step.agentId || '').trim();
    if (!knownAgents.has(agentId)) throw new Error(`Step ${index + 1} references unknown agent ${agentId}`);
    return { type, agentId, input: step.input && typeof step.input === 'object' ? step.input : {} };
  }
  if (type === 'workflow.execute') {
    const request = step.request && typeof step.request === 'object' ? step.request : {};
    return { type, request };
  }
  if (type === 'tool.call') {
    const toolId = String(step.toolId || '').trim();
    if (!toolId || !knownTools.has(toolId)) throw new Error(`Step ${index + 1} references unknown tool ${toolId || '(missing)'}`);
    return { type, toolId, input: step.input && typeof step.input === 'object' ? step.input : {} };
  }
  const command = String(step.command || '').trim();
  const cwd = String(step.cwd || '').trim();
  if (!command) throw new Error(`Step ${index + 1} command is required`);
  const risk = commandRisk(command);
  if (risk.level === 'BLOCKED') throw new Error(`Step ${index + 1} command blocked: ${risk.reason}`);
  return { type, command, cwd, timeoutSeconds: Math.max(1, Math.min(900, Number(step.timeoutSeconds) || 120)), risk };
}

function normalizeSkill(raw, context = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Skill object required');
  const knownAgents = new Set(context.knownAgents || []);
  const knownTools = new Set(context.knownTools || []);
  const name = String(raw.name || '').trim();
  const description = String(raw.description || '').trim();
  if (!name || !description) throw new Error('Skill name and description are required');
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).map((step, index) => normalizeStep(step, index, knownAgents, knownTools));
  if (!steps.length) throw new Error('Skill must contain at least one executable step');
  const triggers = (Array.isArray(raw.triggers) ? raw.triggers : []).map(value => String(value).trim()).filter(Boolean);
  const inputs = raw.inputs && typeof raw.inputs === 'object' && !Array.isArray(raw.inputs) ? raw.inputs : {};
  const requiresApprovalEachRun = steps.some(step => step.type === 'command.run' && step.risk.level !== 'SAFE_AUTOMATIC');
  return {
    schema: SCHEMA, id: String(raw.id || crypto.randomUUID()), name, description, triggers, inputs, steps,
    verification: String(raw.verification || 'Record step results and verify declared outcome.'),
    failurePolicy: String(raw.failurePolicy || 'PRESERVE_FAILURE_BRANCH_AND_STOP'),
    requiresAIAtRuntime: false, requiresApprovalEachRun,
    teacher: context.teacher || 'unknown', state: 'CANDIDATE', createdAt: new Date().toISOString()
  };
}

function compileTeacherReply(text, context = {}) {
  const skill = normalizeSkill(extractJson(text), context);
  const skillHash = hash(skill);
  return Object.freeze({ ...skill, skillHash });
}

class LearnedSkillRegistry {
  constructor(root) {
    this.root = path.join(root, 'learned-skills');
    fs.mkdirSync(this.root, { recursive: true });
  }

  file(id) { return path.join(this.root, String(id).replace(/[^a-z0-9._-]/gi, '_') + '.json'); }

  save(skill) {
    const target = this.file(skill.id), temp = target + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(skill, null, 2), 'utf8');
    fs.renameSync(temp, target);
    return skill;
  }

  load(id) {
    const file = this.file(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  list() {
    return fs.readdirSync(this.root).filter(name => name.endsWith('.json'))
      .map(name => this.load(name.slice(0, -5))).filter(Boolean);
  }

  promote(id, validation = {}) {
    const skill = this.load(id);
    if (!skill) throw new Error('Unknown learned skill');
    if (validation.passed !== true) throw new Error('Local validation must pass before promotion');
    const promoted = {
      ...skill,
      state: 'PROMOTED',
      promotedAt: new Date().toISOString(),
      validation: {
        passed: true,
        evidence: validation.evidence || null,
        validator: validation.validator || 'DT_LOCAL_VALIDATOR'
      }
    };
    promoted.skillHash = hash({ ...promoted, skillHash: undefined });
    return this.save(promoted);
  }

  match(prompt) {
    const q = String(prompt || '').toLowerCase();
    return this.list().filter(skill => skill.state === 'PROMOTED')
      .map(skill => ({ skill, score: skill.triggers.reduce((n, trigger) => n + (q.includes(trigger.toLowerCase()) ? 1 : 0), 0) }))
      .filter(row => row.score > 0).sort((a, b) => b.score - a.score);
  }
}

async function executeSkill(skill, input = {}, runtime = {}) {
  if (!skill || skill.state !== 'PROMOTED') throw new Error('Only promoted learned skills may execute');
  const results = [];
  for (const [index, step] of skill.steps.entries()) {
    let result;
    if (step.type === 'agent.run') result = await runtime.runAgent(step.agentId, { ...step.input, ...input });
    else if (step.type === 'workflow.execute') result = await runtime.executeWorkflow({ ...step.request, ...input });
    else if (step.type === 'tool.call') result = await runtime.callTool(step.toolId, { ...step.input, ...input });
    else if (step.type === 'command.run') {
      if (step.risk.level !== 'SAFE_AUTOMATIC' && runtime.ownerApproved !== true) {
        throw new Error(`Skill step ${index + 1} requires owner approval`);
      }
      result = await runtime.runCommand(step, input);
    } else throw new Error(`Unsupported learned skill step ${step.type}`);
    results.push({ index, type: step.type, result });
  }
  return {
    skillId: skill.id,
    skillHash: skill.skillHash,
    requiresAIAtRuntime: false,
    results,
    completedAt: new Date().toISOString()
  };
}

function teacherPrompt(observation, context = {}) {
  return [
    'Teach the DT Platform a reusable local skill. Return JSON only; no markdown.',
    'The resulting skill must execute later without any AI provider.',
    'Allowed step types: agent.run, workflow.execute, tool.call, command.run.',
    'Prefer DT agents/workflows over shell commands. Never include credentials or secrets.',
    'For command.run, use bounded read/build/test commands where possible.',
    `Known DT agents: ${(context.knownAgents || []).join(', ')}`,
    'Required keys: name, description, triggers[], inputs{}, steps[], verification, failurePolicy.',
    '', 'Owner instruction:', String(observation || '').trim()
  ].join('\n');
}

module.exports = { SCHEMA, STEP_TYPES, hash, extractJson, normalizeSkill,
  compileTeacherReply, LearnedSkillRegistry, executeSkill, teacherPrompt };
