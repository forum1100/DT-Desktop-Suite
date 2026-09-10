# Execution evidence — 2026-09-09

Status: **VALIDATED REPLAY OF REPAIRED RECONSTRUCTION; NOT PHYSICAL VALIDATION**

## Source chain

The historical source was independently recovered in the connected Gmail account as message `19e0e657467a93e4`, subject `Sim Code phase correction....`, sent 2026-05-09 16:19 -04:00. Its body begins with the exact simulation-pack title and contains the Python source. A forwarded copy exists as message `19e13c6074ae3bca` dated 2026-05-10.

Drive also contains multiple preserved PDF copies of the same email/source, including Drive ID `1tRSme6ZtvUfAMSW4fwU43VsR3LFi1eNP`. The executable `simulation.py` in this pack is still classified as a repaired reconstruction because syntax/formatting repairs were made for execution; the historical Gmail message remains the higher-provenance source.

## Runtime

Python 3.13 with NumPy 2.5.3 and pandas 3.0.5. Command:

`python simulation.py --trials 50 --out-dir results`

The first execution attempt failed because NumPy was unavailable to the active Python interpreter. That failure is preserved. NumPy and pandas were then installed into the active interpreter and the same command was rerun successfully.

## 50-trial result

| mode | avg cycles | avg mean error | avg pair RMS | avg triad RMS | avg very-deep | avg ultra-deep | avg rollbacks | score |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| fact_only | 404.62 | 0.0019313 | 0.0027969 | 0.0028804 | 8.00 | 4.58 | 0.00 | 23.5489 |
| hybrid | 650.00 | 0.0056565 | 0.0022413 | 0.0025464 | 2.50 | 0.00 | 0.00 | 2.2988 |
| topology_only | 650.00 | 0.0056761 | 0.0020347 | 0.0024398 | 2.14 | 0.00 | 0.40 | 1.5930 |

## Interpretation

Under this repaired reconstruction and these fixed target corridors, `fact_only` materially outperformed both `hybrid` and `topology_only` on the pack's own aggregate score and final mean error. Both topology-containing modes hit the 650-cycle ceiling in every trial on average. The result therefore does **not** support a claim that the hybrid handoff is superior in this implementation.

This is a useful failed/contradictory branch rather than something to erase. It indicates that either the topology/handoff implementation, its thresholds, or the scoring/target construction requires further adversarial testing before any stronger claim is made. The relational metrics are somewhat better for topology-containing modes, but that did not translate into the pack's total convergence score.

The simulation remains a meta-model whose targets are encoded by the model itself. Convergence toward those targets is a software-behavior result, not independent evidence for the underlying physical propositions.

## Search scope expanded beyond the desktop suite

A machine-wide content search under `C:\Users\thoma` located the reconstructed code in both the public `Distel-Theory-Research` working tree and the `DT-Desktop-Suite` tree. The original source was also located independently in Gmail and multiple Drive-preserved copies. GitHub code search confirms the public research repository contains the reconstructed implementation. This provenance pass is intentionally cross-surface rather than limited to a single suite or folder.

Generated CSV outputs are preserved in `results/` locally; the compact summary should be published with this evidence record. Full trial/history CSVs are larger execution artifacts and should remain available as replay outputs rather than being mistaken for source evidence.
