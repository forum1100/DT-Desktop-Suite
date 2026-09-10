# Causal Process Invariant
Status: GOVERNING CORRECTION / IMPLEMENTATION CANDIDATE
Date: 2026-09-10 EDT

The primary reconstruction unit is not an isolated message, file, result, or final answer. It is the causal process that produced the next state.

Canonical causal chain:
BEFORE -> OBSERVATION -> ASSISTANT PROPOSAL / INTERPRETATION -> USER RESPONSE / AUTHORIZATION -> ACTION / EXECUTION -> RESULT -> VALIDATION -> FAILURE OR CORRECTION -> NEXT PROPOSAL -> NEXT STATE

A short user continuation such as "go ahead", "continue", "ok", "yes", "keep going", or equivalent inherits the actionable meaning of the immediately preceding assistant proposal unless contrary evidence exists. Preserve the user's literal text and the inherited causal edge separately; never rewrite the user message into language they did not say.

For simulations and iterative work, preserve why a run was attempted, what the prior run exposed, what changed, why it changed, the exact failure mode, the correction, whether the correction worked, and how that result caused the next run.

The destination never substitutes for the trip. A final successful artifact does not authorize deletion, flattening, or summarization-away of the failed, superseded, exploratory, corrective, or contradictory path that produced it.

This invariant applies across DT_CLOSEOUT, export reconciliation, simulations, Agent Foundry, Librarian custody, Perception Points, GitHub publication, Drive archival, and future autonomous workflows.
## Validation provenance correction
Validation is itself a causal process. A receipt or zero exit code is not sufficient evidence of success. Preserve and verify: exact input bytes/hash, executed command or tool action, environment/runtime version, outputs/artifacts, readback state, failure conditions, and the causal edge from execution to report.

Message-graph parentage outranks chronological proximity when reconstructing causation. A direct parent/child node relationship is the preferred evidence for which assistant report follows an execution; timestamps are secondary ordering evidence.

Execution output and assistant narrative are distinct evidence layers. When a narrative summary disagrees with historical tool output, recovered artifact bytes, or a source-faithful replay, record `NARRATIVE_REPLAY_DIVERGENCE` and preserve both. Do not silently normalize one into the other.

Evidence precedence for numerical validation: original historical artifact bytes > historical execution/tool output bound to the exact node > source-faithful code replay with environment provenance > assistant narrative/summary. Missing higher-priority evidence remains an explicit residual.