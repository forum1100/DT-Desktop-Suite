# Causal Validation v2 — Black-Hole / Recursive-Learning Lineage

Status: `PARTIAL_REPLAY_CERTIFICATION / CAUSAL_PROCESS_VALIDATED`

The validation unit is the causal process, not an isolated receipt or endpoint. For every run this record traces the historical executed source, direct message-graph response, expected output-artifact family, current replay, and unresolved divergence.

## Structural validation
- 18/18 recovered source cells match their manifest SHA-256.
- 18/18 replayable run records regenerate exactly the artifact filename set historically linked by the direct child assistant response, including the two failed runs where the expected set is empty.
- 16/18 source cells complete under the bounded portable replay.
- Runs 13 and 15 retain their historical `KeyboardInterrupt` lineage and also time out under the bounded current replay.
- Every recovered run contains an explicit fixed RNG seed, strengthening reproducibility analysis.

## Validation precedence
1. Original historical artifact bytes, when independently recovered.
2. Historical execution/tool output tied to the exact execution node.
3. Source-faithful executed code plus environment-aware replay.
4. Assistant narrative/reporting derived from the execution.

A lower layer cannot silently override a higher layer. A PASS receipt is insufficient unless the bytes, command, environment, outputs, and causal parentage are recoverable.## Narrative/replay divergences
The historical assistant narrative is not automatically treated as numerical ground truth. Several direct-child reports disagree with the current replay of the exact seeded source cell. Examples:

- Run 3 narrative reported final mean error `0.019336`; current seeded replay summary gives `0.019195`.
- Run 4 narrative reported a final error near `0.0244`; current seeded replay summary gives `0.019590`.
- Run 6 narrative reported final error near `0.0462`; current seeded replay summary gives `0.024901`.
- Run 7 narrative reported a final error near `0.0413`; current seeded replay summary gives `0.023374`.

These are classified `NARRATIVE_REPLAY_DIVERGENCE`, not silently corrected history. Possible causes include historical environment differences, assistant reporting error, or unrecovered historical output bytes. Exact historical CSV recovery remains the preferred resolver.

## Causal sequence preserved
The lineage includes proxy screening; recursive correction; plateau/oversteer detection; failed singularity push; preservation/rollback learning; restart; selective reopening; shared-edge correction; domain microstructure; equation locking; covariance correction; autonomous stopping; two heavy Prism failures; lighter Prism replacements; hard physical gates; and the failed first convergence-inheritance claim.

Each transition preserves `result -> interpretation -> proposed change -> user continuation/authorization -> next execution`. Short user continuations remain verbatim and are linked to, not substituted for, the preceding assistant proposal.

Scientific status remains toy/meta-simulation evidence. This validation establishes provenance and causal development, not physical confirmation of DT.