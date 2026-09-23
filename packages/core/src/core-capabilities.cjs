const fs = require('node:fs');
const path = require('node:path');
const { buildSetupGuide } = require('./ai-setup-guide.cjs');
const { findMatches } = require('./orion-capability.cjs');
const { evaluateInteraction } = require('./accessibility-lab.cjs');

function underRoots(target, roots) {
  const resolved = path.resolve(String(target || ''));
  return roots.some(root => {
    const base = path.resolve(root);
    return resolved === base || resolved.startsWith(base + path.sep);
  });
}

function registerCoreCapabilities(bus, context = {}) {
  const environment = context.environment || {};
  const roots = [environment.home,
    ...(environment.googleDrive || []).map(item => item.root),
    ...(context.extraRoots || [])].filter(Boolean);

  bus.register({
    id: 'system.environment', description: 'Read DT bootstrap and machine discovery state.',
    risk: 'READ_ONLY'
  }, async () => environment);

  bus.register({
    id: 'google_drive.roots', description: 'List Google Drive roots detected on this installation.',
    risk: 'READ_ONLY', hardwareClass: 'storage'
  }, async () => environment.googleDrive || []);
  bus.register({
    id: 'filesystem.list', description: 'List a local directory under DT-authorized roots.',
    risk: 'READ_ONLY', hardwareClass: 'storage'
  }, async input => {
    const target = path.resolve(String(input.path || environment.home || '.'));
    if (!underRoots(target, roots)) throw new Error('Path outside DT-authorized roots');
    return fs.readdirSync(target, { withFileTypes: true }).map(item => ({
      name: item.name, type: item.isDirectory() ? 'directory' : item.isFile() ? 'file' : 'other'
    }));
  });

  bus.register({
    id: 'filesystem.read', description: 'Read a bounded UTF-8 text file under DT-authorized roots.',
    risk: 'READ_ONLY', hardwareClass: 'storage'
  }, async input => {
    const target = path.resolve(String(input.path || ''));
    if (!underRoots(target, roots)) throw new Error('Path outside DT-authorized roots');
    const stat = fs.statSync(target);
    if (!stat.isFile()) throw new Error('Target is not a file');
    const maxBytes = Math.max(1, Math.min(4 * 1024 * 1024, Number(input.maxBytes) || 1024 * 1024));
    const fd = fs.openSync(target, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, maxBytes));
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
      return { path: target, bytes, truncated: stat.size > bytes, text: buffer.subarray(0, bytes).toString('utf8') };
    } finally { fs.closeSync(fd); }
  });

  bus.register({
    id: 'powershell.run', description: 'Run a bounded DT-governed PowerShell command headlessly.',
    risk: 'DYNAMIC', hardwareClass: 'computer'
  }, async (input, callContext) => {
    const result = context.runHeadlessCommand({
      command: String(input.command || ''),
      cwd: String(input.cwd || environment.home || ''),
      timeoutSeconds: Number(input.timeoutSeconds) || 120
    }, input.variables || {}, {
      ownerApproved: callContext.ownerApproved === true,
      defaultCwd: environment.home,
      allowedRoots: roots
    });
    context.experience?.append('headless-command', {
      command: result.command, cwd: result.cwd, exitCode: result.exitCode,
      stdout: result.stdout, stderr: result.stderr, success: result.exitCode === 0
    }, { capability: 'powershell.run' });
    if (result.exitCode !== 0 || result.error) {
      context.residentRuntime?.submitIncident({
        source: 'powershell.run', command: result.command, cwd: result.cwd,
        exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, error: result.error
      });
    }
    return result;
  });

  bus.register({
    id: 'ai.setup_guide',
    description: 'Generate provider-neutral setup instructions and a copy/paste bootstrap prompt for connecting an AI assistant to DT.',
    risk: 'READ_ONLY',
    hardwareClass: 'computer'
  }, async input => buildSetupGuide({
    provider: input?.provider || 'other',
    deviceId: input?.deviceId || context.deviceId || null,
    cliPath: input?.cliPath || context.cliPath || 'DT Command Center / DT governed CLI',
    capabilities: bus.list().map(item => item.id)
  }));

  bus.register({
    id: 'orion.capability.audit',
    description: 'Ask Orion whether DT already possesses a requested capability; explain how to use it or consult AI peers when absent.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async input => {
    const question = String(input?.capability || input?.question || input?.task || '').trim();
    if (!question) throw new Error('Capability question required');
    const skills = typeof context.getSkills === 'function' ? context.getSkills() : [];
    const matches = findMatches(question, bus.list(), skills);
    const best = matches[0] || null;
    const possessed = Boolean(best && best.score >= 0.34);
    if (possessed) return { identity:'Orion', possessed:true, match:best, howToUse:best.kind==='tool' ? '/tool '+best.id+' { ... }' : 'Ask Orion naturally; route to promoted skill '+best.id, matches };
    const council = typeof context.runAICouncil === 'function' ? await context.runAICouncil({ advisoryOnly:true, task:'Orion capability gap: '+question+'. Design and implement this from scratch for DT Desktop. Return architecture, implementation path, tests, risks, and integration points.' }, {}) : null;
    return { identity:'Orion', possessed:false, matches, consultedPeers:Boolean(council), council };
  });

  bus.register({
    id: 'accessibility.evaluate_interaction',
    description: 'Generate synthetic accessibility scenarios and measurable success criteria for interacting with Orion without prompt-engineering knowledge.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async input => evaluateInteraction(input || {}));
  bus.register({
    id: 'ai.council.decide_and_act',
    description: 'Consult available configured AI peers, have the resident DT model synthesize their recommendations, and enact the selected bounded DT tool or promoted skill.',
    risk: 'DYNAMIC', hardwareClass: 'computer'
  }, async (input, callContext) => {
    if (typeof context.runAICouncil !== 'function') throw new Error('DT AI Council runtime is unavailable');
    return context.runAICouncil(input || {}, callContext || {});
  });

  bus.register({
    id: 'ai.council.status',
    description: 'Read currently eligible council advisors and recent council decision state.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => typeof context.councilStatus === 'function' ? context.councilStatus() : { available:false });

  bus.register({
    id: 'browser.closeout.run_all',
    description: 'Open ChatGPT, Grok, and Gemini sequentially and run one DT_CLOSEOUT task in each through the DT Browser Perception Bridge.',
    risk: 'LOCAL_MUTATION', hardwareClass: 'computer'
  }, async input => {
    const response = await fetch('http://127.0.0.1:43120/v1/browser/closeout/run-all', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({task: String(input?.task || '')})
    });
    if (!response.ok) throw new Error('TJ Personal Pro browser closeout request failed: ' + response.status);
    return response.json();
  });

  bus.register({
    id: 'browser.closeout.status', description: 'Read the current sequential browser DT_CLOSEOUT queue and provider job.',
    risk: 'READ_ONLY', hardwareClass: 'computer'
  }, async () => {
    const response = await fetch('http://127.0.0.1:43120/v1/browser/closeout/state');
    if (!response.ok) throw new Error('TJ Personal Pro browser closeout status failed: ' + response.status);
    return response.json();
  });

  bus.register({
    id: 'runtime.status', description: 'Read resident DT worker/runtime status.',
    risk: 'READ_ONLY'
  }, async () => context.residentRuntime?.status() || { running: false });

  bus.register({
    id: 'runtime.submit_incident', description: 'Submit a DT incident for background diagnosis.',
    risk: 'LOCAL_MUTATION'
  }, async input => context.residentRuntime?.submitIncident(input || {}) || null);

  return { roots, capabilities: bus.list() };
}

module.exports = { registerCoreCapabilities, underRoots };
