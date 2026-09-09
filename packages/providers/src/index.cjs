const PROVIDERS = Object.freeze({
  openai: { baseUrl: 'https://api.openai.com/v1', protocol: 'openai', keyRequired: true },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', protocol: 'anthropic', keyRequired: true },
  xai: { baseUrl: 'https://api.x.ai/v1', protocol: 'openai', keyRequired: true },
  ollama: { baseUrl: 'http://127.0.0.1:11434/v1', protocol: 'openai', keyRequired: false },
  compatible: { baseUrl: null, protocol: 'openai', keyRequired: false }
});

function providerDefinition(id, overrides = {}) {
  const base = PROVIDERS[id];
  if (!base) throw new Error('Unsupported provider');
  const definition = { id, ...base, ...overrides };
  if (!definition.baseUrl) throw new Error('Provider base URL required');
  return definition;
}

async function requestAI(definition, { apiKey, model, messages }) {
  if (definition.keyRequired && !apiKey) throw new Error('Provider key required');
  const headers = { 'content-type': 'application/json' };
  let url, body;
  if (definition.protocol === 'anthropic') {
    url = definition.baseUrl + '/messages';
    Object.assign(headers, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' });
    body = { model, max_tokens: 2048, messages };
  } else {
    url = definition.baseUrl + '/chat/completions';
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    body = { model, messages };
  }
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Provider request failed: ${response.status}`);
  return response.json();
}
module.exports = { PROVIDERS, providerDefinition, requestAI };
