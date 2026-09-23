const DEFAULT_PROFILES = Object.freeze([
  { id:'plain-language', label:'Low reading/prompt literacy', needs:['plain language','examples','recognition over recall'] },
  { id:'working-memory', label:'Limited working-memory load tolerance', needs:['one step at a time','persistent context','no multi-part recall'] },
  { id:'processing-pace', label:'Slower processing pace', needs:['no timeout pressure','repeat/rephrase','stable controls'] },
  { id:'motor-access', label:'Motor-access constraints', needs:['large targets','keyboard/voice alternatives','few precision actions'] },
  { id:'vision-access', label:'Vision-access constraints', needs:['screen-reader semantics','high zoom','nonvisual status cues'] },
  { id:'hearing-access', label:'Hearing-access constraints', needs:['captions/text equivalents','no audio-only instructions'] },
  { id:'novice-ai', label:'No AI prompting knowledge', needs:['goal buttons','guided choices','proactive next-step suggestions'] }
]);

function evaluateInteraction(input = {}) {
  const description = String(input.description || input.interface || '').trim();
  const profiles = Array.isArray(input.profiles) && input.profiles.length ? input.profiles : DEFAULT_PROFILES;
  const proactive = input.proactive !== false;
  return {
    identity:'Orion', mode:'ACCESSIBILITY_SIMULATION', description,
    guardrail:'Evaluate interaction burden and task success; do not diagnose or infer a person’s cognitive or medical condition.',
    proactiveInteraction: proactive,
    scenarios: profiles.map(profile => ({
      profileId: profile.id, label: profile.label, needs: profile.needs,
      tests: profile.needs.map(need => ({ need, passCriterion:`A user can complete the core task while ${need} is supported.` }))
    })),
    measures:['task completion','time to first successful action','error count','help requests','abandonment','number of free-text prompts required'],
    target:'Core tasks should be discoverable without requiring the user to know how to prompt an AI.'
  };
}

module.exports = { DEFAULT_PROFILES, evaluateInteraction };
