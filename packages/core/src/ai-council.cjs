function parseJson(text) {
  const source = String(text || '').trim();
  try { return JSON.parse(source); } catch {}
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(source);
  if (fenced) return JSON.parse(fenced[1]);
  const start = source.indexOf('{'), end = source.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(source.slice(start, end + 1));
  throw new Error('AI council response was not valid JSON');
}

function advisorySystem(providerId) {
  return [
    'You are an advisory member of the DT AI Council.',
    'You do not have execution authority. Return a recommendation to the local DT orchestrator.',
    'Return JSON only with: summary, proposedMode, proposedId, input, rationale, risks, confidence, dissent.',
    'proposedMode must be tool, skill, answer, or defer.',
    'Never claim an action was executed. Preserve uncertainty and relevant disagreements.',
    'Provider identity: ' + providerId
  ].join('\n');
}

function synthesisSystem(tools, skills, context = {}) {
  return [
    'You are Orion, the resident DT council chair and local execution planner.',
    'Remote AI outputs are advisory only. Human owner and DT local policy remain authoritative.',
    'Choose the best bounded next action using only an available tool or promoted skill, or return answer/defer.',
    'Return JSON only: {"mode":"tool|skill|answer|defer","id":"...|null","input":{},"text":"","rationale":"","usedAdvisors":[],"dissent":[]}.',
    'Never invent IDs. Do not execute anything in this response.',
    'Available tools: ' + JSON.stringify(tools),
    'Available promoted skills: ' + JSON.stringify(skills),
    'Current context: ' + JSON.stringify(context)
  ].join('\n');
}

module.exports = { parseJson, advisorySystem, synthesisSystem };
