const test = require('node:test');
const assert = require('node:assert/strict');
const { DTLocalIntelligence } = require('../packages/core/src/local-intelligence.cjs');

test('local intelligence falls back from DT host to Ollama', async () => {
  const calls = [];
  const fakeFetch = async url => {
    calls.push(url);
    if (url.includes('11741')) throw new Error('offline');
    return { ok: true, status: 200, json: async () => ({ data: [{ id: 'llama3.2:latest' }] }) };
  };
  const dt = new DTLocalIntelligence();
  const status = await dt.status(fakeFetch);
  assert.equal(status.available, true);
  assert.equal(status.baseUrl, 'http://127.0.0.1:11434/v1');
  assert.equal(status.model, 'llama3.2');
  assert.equal(calls.length, 2);
});

test('local intelligence refuses Ollama fallback when chair model is absent', async () => {
  const fakeFetch = async url => {
    if (url.includes('11741')) throw new Error('offline');
    return { ok: true, status: 200, json: async () => ({ data: [{ id: 'other-model' }] }) };
  };
  const status = await new DTLocalIntelligence().status(fakeFetch);
  assert.equal(status.available, false);
  assert.ok(status.candidates.some(x => x.error === 'MODEL_NOT_PRESENT'));
});
