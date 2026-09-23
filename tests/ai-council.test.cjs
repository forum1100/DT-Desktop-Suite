const test = require('node:test');
const assert = require('node:assert/strict');
const { CapabilityBus } = require('../packages/core/src/capability-bus.cjs');
const { registerCoreCapabilities } = require('../packages/core/src/core-capabilities.cjs');
const { PromptRuntime } = require('../packages/core/src/prompt-runtime.cjs');

test('AI council capability delegates decision authority to the local runtime', async () => {
  const bus = new CapabilityBus();
  let seen = null;
  registerCoreCapabilities(bus, { environment:{home:process.cwd(),googleDrive:[]}, runHeadlessCommand:()=>({exitCode:0}),
    runAICouncil: async (input, ctx) => { seen={input,ctx}; return {plan:{mode:'answer'},execution:null}; },
    councilStatus: () => ({available:true}) });
  assert.ok(bus.has('ai.council.decide_and_act'));
  const result = await bus.call('ai.council.decide_and_act', {task:'compare approaches'}, {ownerApproved:true});
  assert.equal(seen.input.task, 'compare approaches');
  assert.equal(seen.ctx.ownerApproved, true);
  assert.equal(result.output.plan.mode, 'answer');
});

test('Ask DT natural language can route through the AI council', async () => {
  const calls=[];
  const runtime = new PromptRuntime({
    skillRegistry:{match:()=>[],list:()=>[]},
    capabilityBus:{has:()=>true,list:()=>[],call:async(id,input)=>{calls.push({id,input});return {ok:true};}},
    localIntelligence:{status:async()=>({available:false})}, executeSkill:async()=>null, vault:null
  });
  const result = await runtime.handle({prompt:'Consult the available AIs, decide the best plan, and act on it.'});
  assert.equal(result.toolId, 'ai.council.decide_and_act');
  assert.equal(calls[0].id, 'ai.council.decide_and_act');
});
