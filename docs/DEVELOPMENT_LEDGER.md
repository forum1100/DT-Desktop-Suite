# Development Ledger

## 2026-09-08 — Foundation build

- Created isolated DT Desktop Suite workspace.
- Defined individual-agent architecture and cross-chat handoff.
- Implemented signed message envelopes, append-only hash-chained vault, scoped key authority, local API gateway, heuristic safety preflight, provider adapters, and eleven initial agent programs.
- Implemented owner binding to GitHub login `forum1100`.
- Implemented two independent single-use recovery tickets requiring verified owner login.

## Preserved failure

The first core test run failed because a remote file-read status line was accidentally inserted into `vault.cjs` during a prepend operation. Node reported `SyntaxError: Unexpected identifier 'on'`.

The malformed file was inspected, replaced cleanly, and the complete suite was rerun. Four behavioral test groups now pass. This repair is successor evidence; the failure remains documented here.


## 2026-09-09 — Protocol shadowing discovered during portability audit

The shared protocol file contained two historical definitions of `createEnvelope` and `verifyEnvelope`. JavaScript accepted both declarations and silently used the later pair, which omitted the newer `authority` and `sourceClass` fields. Existing integrity tests did not assert those fields, so the branch remained runnable while structurally incomplete.

The duplicate implementation was removed. The surviving envelope now defaults unresolved provenance explicitly, retains authority and source class inside the signed body, and safely rejects malformed hashes. Regression tests mutate the source class and require verification to fail. This discovery is preserved rather than rewritten out of the development record.
