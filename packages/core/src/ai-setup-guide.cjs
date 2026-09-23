const crypto = require('node:crypto');

const PROVIDERS = Object.freeze({
  chatgpt: { label: 'ChatGPT' },
  openai: { label: 'OpenAI / ChatGPT' },
  grok: { label: 'Grok' },
  xai: { label: 'xAI / Grok' },
  claude: { label: 'Claude' },
  anthropic: { label: 'Anthropic / Claude' },
  gemini: { label: 'Gemini' },
  google: { label: 'Google Gemini' },
  copilot: { label: 'Microsoft Copilot' },
  other: { label: 'Other AI assistant' }
});

function normalizeProvider(value) {
  const key = String(value || 'other').trim().toLowerCase();
  if (PROVIDERS[key]) return key;
  if (/chatgpt|openai|gpt/.test(key)) return 'chatgpt';
  if (/grok|xai/.test(key)) return 'grok';
  if (/claude|anthropic/.test(key)) return 'claude';
  if (/gemini|google/.test(key)) return 'gemini';
  if (/copilot|microsoft/.test(key)) return 'copilot';
  return 'other';
}

function buildBootstrapPrompt({ provider='other', deviceId=null, cliPath=null, capabilities=[] } = {}) {
  const key = normalizeProvider(provider), label = PROVIDERS[key].label;
  const capabilityText = capabilities.length ? capabilities.join(', ') : 'DT-governed command execution and platform capabilities';
  return [
    `You are being connected to the user's DT Desktop Platform as ${label}.`,
    '',
    'The DT Desktop Platform, not this chat, is the execution and authorization authority.',
    'When the user asks you to perform work on a connected device, route device commands through the DT Desktop command interface rather than bypassing DT with a separate shell/control path.',
    'Use DT-generated setup and command instructions so DT can log the request, command, result, provenance, device identity, failures, and learned procedure.',
    '',
    'Operating rules:',
    '1. Preserve user intent and use DT as the command/control surface whenever DT provides that capability.',
    '2. Do not claim a command ran unless DT returns execution evidence.',
    '3. If DT reports that authorization, pairing, credentials, physical access, or another user action is required, tell the user exactly what DT needs and ask whether they want to do it themselves or authorize DT to do what it can.',
    '4. Reuse standing authorization when DT says it remains valid; do not repeatedly ask for approval unless the authorization policy requires it.',
    '5. Preserve failures and blocked branches as learning evidence. Do not silently work around DT just because another direct route exists.',
    '6. A device becoming available again should allow DT to resume eligible blocked work automatically when its authorization remains valid.',
    '7. Device trust, task permission, and individual sensitive capabilities remain separate scopes.',
    '8. Treat DT logs and receipts as the execution provenance source. Your own narrative is not proof of execution.',
    '',
    `DT device id: ${deviceId || 'DT_WILL_SUPPLY_DEVICE_ID'}`,
    `DT CLI entrypoint: ${cliPath || 'DT_WILL_SUPPLY_CLI_PATH'}`,
    `Advertised capabilities: ${capabilityText}`,
    '',
    'During setup, acknowledge these rules and return a short structured status with:',
    '- provider/model identity as you understand it;',
    '- whether you can send commands through the available DT connector/tool;',
    '- which DT capabilities you can currently reach;',
    '- any setup action still required from the user;',
    '- a harmless DT-routed verification command you propose running.',
    '',
    'Do not perform the verification command until the user or DT authorization policy permits it.'
  ].join('\n');
}

function buildSetupGuide(input = {}) {
  const provider = normalizeProvider(input.provider);
  const setupId = crypto.randomUUID();
  return {
    schema: 'dt-ai-setup-guide/1.0',
    setupId,
    provider,
    providerLabel: PROVIDERS[provider].label,
    generatedAt: new Date().toISOString(),
    userSteps: [
      'Open the AI assistant you want DT to work with.',
      'Give that AI the DT bootstrap prompt below.',
      'If the AI asks for a DT connector or tool, enable the authorized DT Desktop connection for that AI.',
      'Bring the AI setup response back to DT, or let DT ingest it automatically when a connector is available.',
      'Run one harmless DT-routed verification command and confirm DT produced an execution receipt.',
      'After verification, keep the AI attached under the authorization scope you choose.'
    ],
    prompt: buildBootstrapPrompt({ ...input, provider }),
    expectedReply: {
      providerIdentity: 'string',
      dtCommandReachable: 'boolean',
      reachableCapabilities: ['string'],
      userActionRequired: 'string|null',
      proposedVerificationCommand: 'string'
    },
    authority: 'SETUP_GUIDANCE_ONLY',
    automaticExecutionAuthorized: false
  };
}

module.exports = { PROVIDERS, normalizeProvider, buildBootstrapPrompt, buildSetupGuide };
