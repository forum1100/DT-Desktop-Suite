const { preflight } = require('../../safety/src/preflight.cjs');
const { schemas } = require('./schemas.cjs');

function runAgent(agentId, input) {
  if (!schemas[agentId]) throw new Error('Unknown agent');
  const missing = schemas[agentId].filter(field => input[field] === undefined || input[field] === '');
  const safety = preflight({
    text: JSON.stringify(input),
    sources: input.sources || (input.source ? [input.source] : []),
    status: input.status || 'experimental',
    authority: input.authority || 'consumer'
  });
  const output = { agentId, input, missing, safety, createdAt: new Date().toISOString() };
  if (agentId === 'equation' && input.p0 !== undefined && input.pf !== undefined) {
    const p0 = Number(input.p0), pf = Number(input.pf);
    output.constraint = Number.isFinite(p0) && p0 !== 0 && Number.isFinite(pf) ? 1 - (pf / p0) : null;
  }
  if (agentId === 'hallucination') output.riskFlags = safety.flags;
  if (agentId === 'prediction') output.frozen = true;
  if (agentId === 'branch-retest') output.historicalFailurePreserved = true;
  return output;
}
module.exports = { runAgent };
