const { loadPerceptionContext } = require('../../core/src/perception-context.cjs');
const PROVIDERS = Object.freeze({
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', protocol: 'openai', keyRequired: true },
  anthropic: { label: 'Claude / Anthropic', baseUrl: 'https://api.anthropic.com/v1', protocol: 'anthropic', keyRequired: true },
  xai: { label: 'Grok / xAI', baseUrl: 'https://api.x.ai/v1', protocol: 'openai', keyRequired: true },
  ollama: { label: 'Ollama (local)', baseUrl: 'http://127.0.0.1:11434/v1', protocol: 'openai', keyRequired: false },
  compatible: { label: 'OpenAI-compatible', baseUrl: null, protocol: 'openai', keyRequired: false }
});

function providerDefinition(id, overrides = {}) {
  const base = PROVIDERS[id];
  if (!base) throw new Error('Unsupported provider');
  const definition = { id, ...base, ...overrides };
  if (!definition.baseUrl) throw new Error('Provider base URL required');
  const parsed = new URL(definition.baseUrl);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid provider URL protocol');
  return definition;
}

function buildRequest(definition, { apiKey, model, system, messages, perceptionContext }) {
  const perception = perceptionContext || loadPerceptionContext();
  const enrichedSystem = [system, 'DT CURRENT PERCEPTION CONTEXT:', JSON.stringify(perception)].filter(Boolean).join('\n');
  if (definition.keyRequired && !apiKey) throw new Error('Provider key required');
  if (!model) throw new Error('Model required');
  const headers = { 'content-type': 'application/json' };
  if (definition.protocol === 'anthropic') {
    Object.assign(headers, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' });
    return {
      url: definition.baseUrl + '/messages',
      headers,
      body: { model, max_tokens: 2048, system: enrichedSystem, messages: messages.filter(m => m.role !== 'system') }
    };
  }
  if (apiKey) headers.authorization = 'Bearer ' + apiKey;
  return {
    url: definition.baseUrl + '/chat/completions',
    headers,
    body: { model, messages: [{ role: 'system', content: enrichedSystem }, ...messages.filter(m => m.role !== 'system')] }
  };
}

function extractText(definition, data) {
  if (definition.protocol === 'anthropic') {
    return (data.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n');
  }
  return data.choices?.[0]?.message?.content || '';
}

async function requestAI(definition, request, fetchImpl = fetch) {
  const prepared = buildRequest(definition, request);
  const response = await fetchImpl(prepared.url, {
    method: 'POST',
    headers: prepared.headers,
    body: JSON.stringify(prepared.body),
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) throw new Error('Provider request failed: ' + response.status);
  const data = await response.json();
  return { text: extractText(definition, data), raw: data };
}

module.exports = {
  PROVIDERS,
  providerDefinition,
  buildRequest,
  extractText,
  requestAI
};
