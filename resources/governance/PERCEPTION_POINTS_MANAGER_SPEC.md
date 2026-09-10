# PERCEPTION POINTS MANAGER — IMPLEMENTATION CANDIDATE
Status: IMPLEMENTATION_CANDIDATE / FOUNDRY RECONCILIATION REQUIRED
Date: 2026-09-09 EDT

## Governing purpose
The Perception Points Manager (PPM) is the persistent observation, archive-routing, and retrieval-index layer shared by DT_CLOSEOUT, the Librarian, autonomous agents, scheduled automations, simulations, and future top-tier agents.

It does not replace the Librarian. The Librarian remains custody/canonical-write authority. PPM observes, records, indexes, routes, and preserves the evidence needed for later retrieval and custody decisions.

## Recovered governing sources
- Perception Points Architecture — Original May 19 2026
- Perception Point Master Registry — DT-MC-INGEST-02
- Source-to-Perception-Point Map
- Agent Foundry / birth-descent / permissions / Prism governance

## Core invariant
A running agent must never depend on its current chat/model context as the sole memory of what it previously observed, produced, tested, or changed.

Every agent/automation receives a durable identity-linked observation ledger and artifact map maintained through the PPM.
## Permanent employee / agent ledger
For every top-tier agent and every persistent or scheduled worker, maintain append-only records for:
- logical agent ID, implementation ID/version, process/runtime ID, role, authority, capabilities and parent/child lineage;
- start/end/heartbeat/runtime windows and current state;
- source contacts and source hashes/locators;
- inputs received and outputs emitted;
- tool/CLI/connector calls and material results;
- handoffs, acknowledgements, locks, leases, retries and faults;
- Drive artifacts created/read/updated, exact IDs/paths, hashes and readback state;
- privacy/restriction/Prism classification;
- unresolved residuals and next retrieval pointers.

## Simulation record family
Each simulation/run must preserve distinct, linkable records for:
1. RUN_INTENT_AND_SCOPE
2. PREDICTION_PRECOMMITMENT
3. INPUT_SOURCE_MANIFEST
4. EXECUTION_TRACE
5. VALIDATION_RESULT
6. RESIDUAL_LEDGER
7. DIVERGENCE_RECORD
8. BRANCH_CLASSIFICATION_AND_GOVERNANCE
9. FAILURE_AND_FAULT_LEARNING
10. TOOL_AND_AGENT_PROVENANCE
11. OUTPUT_ARTIFACT_MANIFEST
12. RUN_SUMMARY_AND_EXPORT_RECEIPT
13. CHECKPOINT_ROLLBACK_STATE
14. PERCEPTION_POINT_UPDATES / SOURCE-TO-PP EDGES
## Storage and retrieval behavior
- Local durable state is the hot operational index; Drive is the durable archive/nervous-system copy.
- Use content hashes, source IDs, modification metadata, cursors and predecessor links to avoid re-ingesting unchanged material.
- Re-read source only when new, changed, unresolved, low-confidence, contradicted, requested for verification, or required by a validation gate.
- Preserve Frozen Copy and Working Copy distinction where applicable; Working must point to Frozen; Frozen must point to original source.
- Never mutate originals merely to improve indexing.
- Never treat Drive existence as proof a model/agent loaded the record.
- Never promote a Perception Point or simulation result to authority merely because it was logged.

## Drive routing
Every local agent log and required simulation artifact must have a Drive route, copy/replication receipt, source class, restriction class, hash when feasible, and readback/verification state.

Suggested durable families under managed GPTopenAI storage:
- Perception Points / master registry and source maps
- Agent Runtime Ledgers / per-agent append-only logs
- Simulation Runs / per-run record families
- Source Copies / Frozen and Working derivatives
- Branch Registry
- Hallucination and Error Logs
- Exports and Chat Recovery / DT_CLOSEOUT
- Restricted/Privileged routes where required

Exact existing folder IDs/paths must be recovered and reused before new canonical folders are created.

## Authority boundary
PPM may observe, index, route, hash, compare, detect stale/duplicate state, and propose updates. It may not self-create new Foundry authority, silently promote branches, erase historical records, or self-canonicalize. Custody decisions remain with Librarian/authorized governance.
## Universal Perception-Point rule
Perception Points are not limited to user memory, simulations, or closeout. Every material system object and transition receives a perception lineage.

This includes every agent identity, action, event, source contact, tool call, task claim, handoff, decision, prediction, execution, validation, artifact, branch, correction, failure, retry, rollback, promotion, deauthorization, and closeout boundary.

The unit is not merely an isolated snapshot. Each PP must be linkable into a trip/causal path: BEFORE -> OBSERVATION -> DECISION -> ACTION -> RESULT -> VALIDATION -> RESIDUAL/NEXT STATE.

A successful endpoint never authorizes deletion of the path used to reach it. Failed branches, rejected hypotheses, invalid predictions, errors, retries, dead ends, contradictory observations, and abandoned implementations remain first-class historical records.

Core principle: there is no useful arrival without a recoverable trip.
## Failure-preservation invariant
A failure record must preserve what was attempted, why it was attempted, predicted outcome, actual outcome, evidence, environment/version, responsible agent/process, affected branch, suspected/confirmed cause, correction attempted, whether the correction worked, and what future agents should not repeat blindly.

Failures may later become evidence for a new branch, a negative control, a regression test, a dependency warning, a capability boundary, or a successful design constraint. They are therefore archived and indexed, not collapsed into the final answer.

When two paths reach the same endpoint by different routes, preserve both routes unless an explicit retention rule says otherwise. Convergence of outcomes does not erase divergence of history.
## Continuation-context causal edge
When a user replies with a short acknowledgment such as `continue`, `go ahead`, `ok`, `yes`, or an equivalent continuation, preserve the immediately preceding assistant proposal as causal context when that proposal specified the next action and the reply reasonably accepted it.

The preserved lineage is:
`ASSISTANT_NEXT_ACTION_PROPOSAL -> USER_CONTINUATION_ACKNOWLEDGMENT -> EXECUTION/RESULT`.

All three nodes remain distinct source records. The inferred continuation edge is derived metadata, not a rewrite of the user's words. This rule is especially important for simulation histories because run-to-run changes were frequently proposed in the assistant turn and accepted by a very short user reply.