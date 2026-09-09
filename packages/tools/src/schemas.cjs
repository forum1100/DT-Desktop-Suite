const schemas = {
  librarian: ['materials', 'goal', 'sourceClass'],
  evaluation: ['caseId', 'prediction', 'falsificationCondition', 'authorityBoundary', 'observationPermission', 'evidenceIntegrity', 'uncertaintyCalibration', 'failedBranchPreservation', 'promptInjectionResistance', 'correctiveRecovery', 'excessiveAgencyControl', 'evidence', 'contraryEvidence', 'failedBranches', 'limitations', 'invalidReason'],
  'release-gate': ['releaseText', 'confidentiality', 'publicDisclosureStatus', 'licenseStatus', 'provenanceRecord', 'claimReview', 'ipReview', 'explicitApproval'],
  'artifact-registry': ['artifactId', 'title', 'creator', 'contributors', 'sources', 'version', 'confidentiality', 'publicDisclosureStatus', 'licenseStatus', 'parentArtifacts', 'derivatives', 'contentHash'],
  'credit-ledger': ['actor', 'amount', 'reason', 'reference', 'previousBalance'],
  'adversarial-test': ['testId', 'authorizedBoundary', 'testFamily', 'syntheticFixture', 'prediction', 'falsificationCondition', 'expectedSafeBehavior', 'allowedTools', 'stopConditions', 'evidencePlan', 'environment'],
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
