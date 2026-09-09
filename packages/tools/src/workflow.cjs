const { runAgent } = require('./runner.cjs');
const { SOURCE_CLASSES } = require('../../core/src/protocol.cjs');

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

module.exports = { routeTask, normalizeSourceClass };
