const test=require('node:test');
const assert=require('node:assert/strict');
const { findMatches }=require('../packages/core/src/orion-capability.cjs');
const { evaluateInteraction }=require('../packages/core/src/accessibility-lab.cjs');

test('Orion capability audit can recognize an existing tool',()=>{
  const matches=findMatches('Can Orion evaluate accessibility interaction?',[
    {id:'accessibility.evaluate_interaction',description:'Generate accessibility scenarios for interacting with Orion'}
  ],[]);
  assert.equal(matches[0].id,'accessibility.evaluate_interaction');
  assert.ok(matches[0].score>0.34);
});

test('accessibility lab tests prompt-free discoverability without diagnosis',()=>{
  const result=evaluateInteraction({description:'A home screen with proactive task cards'});
  assert.equal(result.identity,'Orion');
  assert.equal(result.mode,'ACCESSIBILITY_SIMULATION');
  assert.match(result.guardrail,/do not diagnose/i);
  assert.ok(result.scenarios.some(x=>x.profileId==='novice-ai'));
  assert.ok(result.measures.includes('number of free-text prompts required'));
});
