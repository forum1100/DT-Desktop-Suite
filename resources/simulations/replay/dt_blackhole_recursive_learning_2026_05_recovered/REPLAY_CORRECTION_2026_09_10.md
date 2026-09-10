# Replay correction — 2026-09-10

Status: `CORRECTION / PRIOR RECEIPT SUPERSEDED`

The first public replay-pack build contained a reconstruction defect: `run_01.py` through `run_18.py` were written as zero-byte files even though the private causal-history extraction had already recorded nonzero historical code lengths and SHA-256 values.

Because empty Python files exit successfully, the first `aggregate_replay_receipt.json` incorrectly reported successful portable execution. That receipt is preserved as failed-process evidence but is not valid replay certification.

The defect was discovered by applying the causal-process rule to the replay itself: source evidence → build action → claimed result → validation. The source-manifest SHA-256 of `e3b0...b855` exposed the mismatch with the historical code hashes.

Correction: all 18 execution cells were re-extracted directly from the original May export execution-output metadata by historical node ID. Every recovered cell now matches the code SHA-256 recorded in the private causal-history ledger.The corrected portability shim also needed a second repair. Historical code wrote outputs through both `/mnt/data/filename` and `Path('/mnt/data') / filename` forms; the first shim rewrote only the former. That caused valid recovered code to fail locally while trying to write to `\mnt\data`. The shim now rewrites both forms while leaving the recovered source cells untouched.

Corrected replay status so far:
- Runs 1–12: portable replay succeeded and regenerated the historical named CSV artifact families.
- Run 13: historical `KeyboardInterrupt`; corrected isolated replay still exceeded the 20-second bound and remains a failure/timeout branch.
- Run 14: portable replay succeeded and regenerated four Prism-from-start artifacts.
- Run 15: historical `KeyboardInterrupt`; corrected isolated replay remains a timeout/failure branch under the current bound.
- Runs 16–18: portable replay succeeded and regenerated the historical named artifact families.

Scientific status is unchanged: these are toy/meta-simulations and do not validate DT or replace GR/QFT. The correction concerns provenance, reproducibility, and causal-history integrity.