const test = require('node:test');
const assert = require('node:assert/strict');
const {
  providerDefinition,
  buildRequest,
  extractText
} = require('../packages/providers/src/index.cjs');

test('OpenAI-compatible request receives DT system context', () => {
  const provider = providerDefinition('openai');
  const request = buildRequest(provider, {
    apiKey: 'fixture-key',
    model: 'fixture-model',
    system: 'preserve failures',
    messages: [{ role: 'user', content: 'question' }]
  });
  assert.equal(request.headers.authorization, 'Bearer fixture-key');
  assert.equal(request.body.messages[0].role, 'system');
  assert.equal(request.body.messages[1].content, 'question');
});

test('Anthropic request separates system from messages', () => {
  const provider = providerDefinition('anthropic');
  const request = buildRequest(provider, {
    apiKey: 'fixture-key',
    model: 'fixture-model',
    system: 'preserve provenance',
    messages: [{ role: 'user', content: 'question' }]
  });
  assert.equal(request.body.system, 'preserve provenance');
  assert.equal(request.body.messages.length, 1);
  assert.equal(request.headers['anthropic-version'], '2023-06-01');
});

test('provider response text normalizes without claiming verification', () => {
  const openai = providerDefinition('openai');
  const anthropic = providerDefinition('anthropic');
  assert.equal(extractText(openai, { choices: [{ message: { content: 'one' } }] }), 'one');
  assert.equal(extractText(anthropic, { content: [{ type: 'text', text: 'two' }] }), 'two');
});

test('custom compatible provider requires an explicit URL', () => {
  assert.throws(() => providerDefinition('compatible'));
  assert.equal(
    providerDefinition('compatible', { baseUrl: 'http://127.0.0.1:9000/v1' }).baseUrl,
    'http://127.0.0.1:9000/v1'
  );
});
