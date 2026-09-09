const test = require('node:test');
const assert = require('node:assert/strict');
const { agents } = require('../packages/tools/src/agents.cjs');
const { briefs } = require('../packages/tools/src/briefs.cjs');

test('every agent has a complete philosophy-to-input brief', () => {
  for (const agent of agents) {
    const brief = briefs[agent.id];
    assert.ok(brief, agent.id + ' brief missing');
    assert.ok(brief.thesis, agent.id + ' thesis missing');
    assert.ok(brief.equation, agent.id + ' equation missing');
    assert.ok(brief.observed, agent.id + ' observation missing');
    assert.ok(brief.input, agent.id + ' input explanation missing');
  }
});
