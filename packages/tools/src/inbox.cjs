const { schemas } = require('./schemas.cjs');
const { briefs } = require('./briefs.cjs');

function processedIds(vault) {
  return new Set(
    vault.all()
      .filter(entry => entry.kind === 'task-processed')
      .map(entry => entry.data.messageId)
  );
}

function inboxFor(agentId, vault) {
  const processed = processedIds(vault);
  return vault.all()
    .filter(entry => entry.kind === 'agent-message')
    .map(entry => entry.data)
    .filter(message =>
      message.recipient === agentId &&
      message.type === 'task' &&
      !processed.has(message.id)
    );
}

function processInbox(agentId, vault, broker, options = {}) {
  if (!schemas[agentId]) throw new Error('Unknown agent inbox');
  const allowed = new Set(options.messageIds || []);
  const allPending = inboxFor(agentId, vault);
  const pending = allowed.size ? allPending.filter(message => allowed.has(message.id)) : allPending;
  const processed = [];
  const failures = [];

  for (const message of pending) {
    try {
      const result = {
        state: 'AWAITING_STRUCTURED_INPUT',
        receivedGoal: message.payload?.goal || null,
        receivedMaterials: message.payload?.materials || null,
        sourceClass: message.sourceClass,
        requiredFields: schemas[agentId],
        governingRelation: briefs[agentId]?.equation || null,
        note: 'Routing context was received; no scientific or factual conclusion has been generated.'
      };
      const response = broker.send({
        sender: agentId,
        recipient: 'librarian',
        type: 'result',
        payload: result,
        authority: ['agent-intake-response'],
        sourceClass: message.sourceClass,
        parentId: message.id,
        branchId: message.branchId
      });
      vault.append('task-processed', agentId, {
        messageId: message.id,
        responseId: response.id,
        state: result.state
      });
      processed.push({ message, response, result });
    } catch (error) {
      const failure = { messageId: message.id, error: error.message };
      vault.append('task-processing-failure', agentId, failure);
      failures.push(failure);
    }
  }

  return {
    agentId,
    pendingBeforeRun: pending.length,
    processed,
    failures,
    pendingAfterRun: inboxFor(agentId, vault).length,
    scopedRun: allowed.size > 0
  };
}

module.exports = { inboxFor, processInbox, processedIds };
