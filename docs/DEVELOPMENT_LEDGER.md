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


## 2026-09-09 — Transfer packaging failures and successor path

The first release-script invocation was blocked by the machine's PowerShell execution policy. The successful successor invocation used `-ExecutionPolicy Bypass` for that one process only; it did not change the system policy.

The second packaging attempt created the unpacked release but `Compress-Archive` failed when Windows temporarily locked a generated launcher. The release builder now uses Windows `tar.exe` with ZIP auto-selection. The successor run created the ZIP, all listed SHA-256 checksums matched, and a relative agent launcher successfully opened Propulsion Conservation from the transfer folder.

## 2026-09-09 — Private capability reconciliation: DT Evaluation Engine

A read-only comparison against the canonical private DT Value Platform archive found that the desktop suite exposed component tools but omitted the earlier integrated behavioral evaluation unit.

The successor implementation restores eight weighted dimensions, 0–4 scoring, a normalized 0.75 passing threshold, critical-dimension gates, pre-registered prediction and falsification, raw and contrary evidence, failed branches, limitations, and distinct PASS, FAIL, INCONCLUSIVE, and INVALID outcomes. It explicitly labels results as behavioral rubric findings rather than proof of model sentience or internal state.

The Google Drive desktop mount listed the private folder but rejected its literal path during this audit. The connected Drive interface provided verified readback without modifying the archive. This access failure and successor path are retained as part of the audit history.

### Preserved deployment branch

The first installed-suite replacement failed because the existing portable DT Desktop Suite executable was open and Windows held a file lock. The release package still completed successfully. The successor deployment selected only processes whose executable path exactly matched the installed DT suite, closed that target, replaced it, reopened the main suite, and smoke-launched the new DT Evaluation Engine with `--agent=evaluation`. No unrelated command window was targeted. Release checksum verification reported zero mismatches.
