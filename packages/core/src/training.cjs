const crypto = require('node:crypto');

function normalizeSteps(observation) {
  const source = String(observation || '').trim();
  if (!source) throw new Error('Training observation required');
  const lines = source.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const candidates = lines.flatMap(line => line
    .replace(/^[-*\d.)\s]+/, '')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(value => value.trim())
    .filter(Boolean));
  return candidates.length ? candidates : [source];
}

function createLocalProcedure(observation, context = {}) {
  const source = String(observation || '').trim();
  const steps = normalizeSteps(source);
  const canonical = JSON.stringify({ source, steps, context });
  return Object.freeze({
    schema: 'dt-local-procedure/1.0',
    id: crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24),
    title: String(context.title || steps[0]).slice(0, 120),
    observation: source,
    steps,
    context,
    sourceAuthority: 'HUMAN_OWNER_INSTRUCTION',
    requiresAI: false,
    executionMode: 'DETERMINISTIC_LOCAL_RUNBOOK',
    verification: 'EXECUTE_BOUNDEDLY_AND_RECORD_RESULT',
    failurePolicy: 'PRESERVE_FAILURE_BRANCH',
    createdAt: new Date().toISOString()
  });
}

module.exports = { normalizeSteps, createLocalProcedure };
