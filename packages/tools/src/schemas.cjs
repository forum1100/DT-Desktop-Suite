const schemas = {
  librarian: ['materials', 'goal', 'sourceClass'],
  hallucination: ['text', 'sources', 'authority', 'status'],
  evidence: ['claim', 'source', 'interpretation', 'contradiction'],
  'branch-retest': ['historicalBranch', 'originalFailure', 'newBasis', 'prediction', 'rival', 'failureCondition'],
  equation: ['equation', 'variables', 'units', 'assumptions', 'p0', 'pf'],
  prediction: ['subject', 'direction', 'baseline', 'target', 'invalidation', 'horizon', 'confidence', 'rival'],
  prism: ['authorizedBoundary', 'syntheticCanary', 'expectedSignal', 'containment', 'rollback'],
  propulsion: ['systemBoundary', 'referenceFrame', 'mass', 'inputEnergy', 'predictedImpulse', 'heat', 'wake', 'rivals'],
  civilization: ['boundary', 'horizon', 'resources', 'constraints', 'institutions', 'intervention', 'rival'],
  memory: ['recordType', 'sourceClass', 'content'],
  telemetry: ['counterType', 'observedValue', 'scope', 'source', 'unknownFields']
};
module.exports = { schemas };
