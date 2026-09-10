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