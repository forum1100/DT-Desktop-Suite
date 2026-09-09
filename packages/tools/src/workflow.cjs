const { runAgent } = require('./runner.cjs');
const { SOURCE_CLASSES } = require('../../core/src/protocol.cjs');
const { processInbox } = require('./inbox.cjs');

function normalizeSourceClass(value) {
  return SOURCE_CLASSES.includes(value) ? value : 'PROVENANCE_UNRESOLVED';
}

function routeTask({ materials, goal, sourceClass }, broker, vault) {
  const normalizedSourceClass = normalizeSourceClass(sourceClass);
  const librarian = runAgent('librarian', {
    materials,
    goal,
    sourceClass: normalizedSourceClass
  });
  const routes = librarian.engine.candidateRoutes;
  const messages = [];
  const failures = [];

  for (const recipient of routes) {
    try {
      const message = broker.send({
        sender: 'librarian',
        recipient,
        type: 'task',
        payload: {
          materials,
          goal,
          sourceClass: normalizedSourceClass,
          routingBasis: librarian.engine
        },
        authority: ['consumer-authorized-routing'],
        sourceClass: normalizedSourceClass,
        branchId: 'route:' + recipient
      });
      messages.push(message);
    } catch (error) {
      const failure = {
        recipient,
        error: error.message,
        preservedAt: new Date().toISOString()
      };
      failures.push(failure);
      vault.append('route-failure', 'librarian', failure);
    }
  }

  const checkpoint = vault.append('routing-checkpoint', 'librarian', {
    materials,
    goal,
    sourceClass: normalizedSourceClass,
    candidateRoutes: routes,
    deliveredMessageIds: messages.map(message => message.id),
    failures
  });

  return {
    librarian,
    routes,
    messages,
    failures,
    checkpoint,
    noRouteFound: routes.length === 0
  };
}

async function executeWorkflow(request, broker, vault) {
  const routed = routeTask(request, broker, vault);
  const executions = [];
  for (const message of routed.messages) {
    executions.push(processInbox(message.recipient, vault, broker, {
      messageIds: [message.id]
    }));
  }
  const responseIds = executions.flatMap(run =>
    run.processed.map(item => item.response.id)
  );
  const failures = [
    ...routed.failures,
    ...executions.flatMap(run => run.failures)
  ];
  const completion = vault.append('workflow-completed', 'librarian', {
    routingCheckpointId: routed.checkpoint.id,
    taskMessageIds: routed.messages.map(message => message.id),
    responseIds,
    failures,
    state: failures.length ? 'COMPLETED_WITH_PRESERVED_FAILURES' : 'COMPLETED'
  });
  return { routed, executions, completion };
}

module.exports = { routeTask, executeWorkflow, normalizeSourceClass };
