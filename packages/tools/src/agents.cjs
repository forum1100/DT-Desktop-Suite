const common = {
  canSend: ['task', 'result', 'evidence', 'checkpoint', 'failure'],
  canReceive: ['task', 'result', 'evidence', 'checkpoint', 'failure']
};

const agents = [
  ['librarian', 'The Librarian', 'Provenance, custody, deduplication, and routing', 'operational', '#78f7ff'],
  ['source-discovery', 'Source Discovery Spark', 'Locate canonical sources and record explicit gaps without reconstruction', 'operational', '#55d6ff'],
  ['ingestion-spark', 'Ingestion Spark', 'Classify, hash, deduplicate, and stage source material without promotion', 'operational', '#66ffcc'],
  ['verbatim-archive', 'Verbatim Archive Spark', 'Build source-faithful chronological records separate from derived prose', 'operational', '#f7f7ff'],
  ['derived-model', 'Derived Conversation Model', 'Map concepts, equations, decisions, branches, failures, and residuals', 'experimental', '#b69cff'],
  ['export-spark', 'Export Spark', 'Package source and derived components with manifests, hashes, and readback receipts', 'operational', '#4df0a7'],
  ['divergence-spark', 'Divergence Spark', 'Detect contradictions and successor changes without deciding authority', 'operational', '#ff4fd8'],
  ['branch-spark', 'Branch Spark', 'Govern branch authority while preserving historical states and failed branches', 'operational', '#ff9f43'],
  ['index-spark', 'Index Spark', 'Create temporal cross-worker lineage indexes without changing custody', 'operational', '#41a7ff'],
  ['completion-spark', 'Completion Spark', 'Evaluate definition-of-done gates without conferring canonicality', 'operational', '#ffe066'],
  ['agent-foundry', 'Agent Foundry', 'Register bounded agent candidates, authority, birth state, and handoff contracts', 'experimental', '#ff6bb5'],
  ['dt-closeout', 'DT Closeout Coordinator', 'Coordinate canonical-first closeout phases and preserve partial status', 'operational', '#00ffff'],
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
  ['telemetry', 'Execution Telemetry', 'Runtime budgets, tool events, and unverifiable counters', 'experimental', '#ff8c42'],
  ['simulation-replay', 'Simulation Replay Lab', 'Registry-backed execution of recovered simulation packs with preserved receipts', 'experimental', '#00d4ff'],
  ['operations-historian', 'Agent Operations Historian', 'Append-only runtime history and bounded swarm-efficiency recommendations', 'operational', '#32ff9a'],
  ['suite-release-manager', 'Suite Release Manager', 'Repository, patch, upgrade, test, rollback, and release governance', 'operational', '#4f8cff']
].map(([id, name, purpose, status, color]) => ({ id, name, purpose, status, color, ...common }));

module.exports = { agents };
