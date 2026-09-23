const test = require('node:test');
const assert = require('node:assert/strict');
const { CapabilityBus } = require('../packages/core/src/capability-bus.cjs');
const { registerCoreCapabilities } = require('../packages/core/src/core-capabilities.cjs');
const { PromptRuntime } = require('../packages/core/src/prompt-runtime.cjs');
const { buildSetupGuide } = require('../packages/core/src/ai-setup-guide.cjs');

test('buildSetupGuide creates provider-neutral bootstrap prompt', () => {
  const guide = buildSetupGuide({ provider: 'chatgpt', deviceId: 'device-test', cliPath: 'DT CLI', capabilities: ['powershell.run'] });
  assert.equal(guide.providerLabel, 'ChatGPT');
  assert.equal(guide.authority, 'SETUP_GUIDANCE_ONLY');
  assert.equal(guide.automaticExecutionAuthorized, false);
  assert.match(guide.prompt, /DT Desktop Platform/);
  assert.match(guide.prompt, /execution and authorization authority/);
  assert.match(guide.prompt, /device-test/);
  assert.match(guide.prompt, /powershell\.run/);
});

test('core capability bus exposes ai.setup_guide', async () => {
  const bus = new CapabilityBus();
  registerCoreCapabilities(bus, {
    environment: { home: process.cwd(), googleDrive: [] },
    deviceId: 'device-test',
    cliPath: 'DT CLI',
    runHeadlessCommand: () => { throw new Error('not used'); }
  });
  assert.equal(bus.has('ai.setup_guide'), true);
  const result = await bus.call('ai.setup_guide', { provider: 'claude' }, {});
  assert.equal(result.output.providerLabel, 'Claude');
  assert.match(result.output.prompt, /Claude/);
});

test('PromptRuntime routes natural language AI setup request locally', async () => {
  const bus = new CapabilityBus();
  registerCoreCapabilities(bus, {
    environment: { home: process.cwd(), googleDrive: [] },
    deviceId: 'device-test',
    cliPath: 'DT CLI',
    runHeadlessCommand: () => { throw new Error('not used'); }
  });
  const skills = { match: () => [], list: () => [], load: () => null };
  const runtime = new PromptRuntime({
    skillRegistry: skills,
    capabilityBus: bus,
    localIntelligence: { status: async () => ({ available: false }) },
    executeSkill: async () => null,
    vault: null
  });
  const result = await runtime.handle({ prompt: 'set up ChatGPT with DT', runtime: {} });
  assert.equal(result.mode, 'tool');
  assert.equal(result.toolId, 'ai.setup_guide');
  assert.equal(result.result.output.providerLabel, 'ChatGPT');
});
