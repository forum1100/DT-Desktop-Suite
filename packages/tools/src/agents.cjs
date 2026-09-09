const common = {
  canSend: ['task', 'result', 'evidence', 'checkpoint', 'failure'],
  canReceive: ['task', 'result', 'evidence', 'checkpoint', 'failure']
};

const agents = [
  ['librarian', 'The Librarian', 'Provenance, custody, deduplication, and routing', 'operational', '#78f7ff'],
  ['evaluation', 'DT Evaluation Engine', 'Reproducible weighted behavioral cases with critical safety gates', 'experimental', '#00e5ff'],
  ['release-gate', 'Public Release Gate', 'Sanitized publication review for secrets, claims, licensing, and approval', 'operational', '#ff335f'],
  ['artifact-registry', 'Artifact Registry', 'Stable identity, provenance, confidentiality, licensing, and lineage records', 'operational', '#4dffb8'],
  ['credit-ledger', 'DT Evaluation Credit Ledger', 'Non-transferable internal service and contribution metering', 'experimental', '#ffd166'],
  ['adversarial-test', 'Adversarial Test Lab', 'Authorized isolated synthetic AI-security test design and evidence capture', 'synthetic-only', '#ff7a45'],
  ['hallucination', 'Hallucination Inspector', 'Heuristic unsupported-certainty and evidence-risk scan', 'experimental', '#ff4fd8'],
  ['evidence', 'Evidence Mapper', 'Separate sources, claims, interpretations, and contradictions', 'operational', '#76ff9f'],
  ['branch-retest', 'Branch Retest Lab', 'Freeze and test successor evidence without erasing failure history', 'operational', '#ffbe55'],
  ['equation', 'Equation Workbench', 'Audit variables, units, assumptions, and bounded calculations', 'experimental', '#a98bff'],
  ['prediction', 'Prediction Lab', 'Freeze paper predictions and validate later outcomes', 'experimental', '#ff6b6b'],
  ['prism', 'Prism Defense', 'Authorized synthetic defensive canaries, containment, and rollback', 'synthetic-only', '#55aaff'],
  ['propulsion', 'Propulsion Conservation', 'Momentum, energy, heat, wake, and detectability audit', 'experimental', '#f2f2f2'],
  ['civilization', 'Civilization Systems', 'Constraint-resource topology and scenario comparison', 'experimental', '#ffd166'],
  ['memory', 'Consumer Memory Vault', 'Local append-only records and portable exports', 'operational', '#63e6be'],
  ['telemetry', 'Execution Telemetry', 'Runtime budgets, tool events, and unverifiable counters', 'experimental', '#ff8c42']
].map(([id, name, purpose, status, color]) => ({ id, name, purpose, status, color, ...common }));

module.exports = { agents };
