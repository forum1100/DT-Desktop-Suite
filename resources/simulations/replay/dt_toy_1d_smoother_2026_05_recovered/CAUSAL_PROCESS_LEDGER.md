# Toy 1D Smoother / Memory-Reconstruction Branch — Causal Process Ledger

Status: VERBATIM EXECUTION CELLS RECOVERED / 3-OF-3 PORTABLE REPLAY COMPLETED

Source conversation: `Toy 1D Smoother Limitations` (`6a04b0a6-08ec-83ea-a887-cb63445a9cc7`). The three execution cells form a parent-linked causal chain in the exported message graph; they are not merely timestamp-adjacent.

Scientific boundary: this is a synthetic memory/reconstruction simulator. Its scores concern behavior of the constructed task and do not prove a general law of human memory, AI memory, or DT.

## Run 1 — evidence-gated reconstruction after a failed prediction
The preceding branch had produced an important negative result: the current recursive-preservation strategy did not beat the stronger keyword-retrieval baseline. The assistant proposed revising the inner reconstruction logic into an evidence-gated version and rerunning against the same baselines. The user's literal continuation was: `Go ahead`.

That makes Run 1 a correction run, not an independent success test. Its purpose was to reduce unsupported/hallucinated links without destroying recall. The exact execution cell is preserved as `run_01.py` and replays successfully.
## Run 2 — derivative forecasting and convergence tracking
The user then pushed the model toward explicit prediction: predict the next derivative or next two derivatives, apply the first derivative, rerun, and compare prediction against the actual next state. The assistant proposed a Derivative Forecast / Convergence Tracker so tightening, flatness, or divergence could be measured across cycles rather than narrated afterward.

The user's continuation was: `Go ahead, add it into the logic, and let's keep on going.` The resulting execution cell is parent-descended from Run 1 in the exported graph and is preserved as `run_02.py`.

Causal change: the branch moved from reconstruction quality alone to prediction-error dynamics. This is important because it converts “learning” into a falsifiable within-simulation signal: predicted derivative versus actual derivative.

## Run 3 — registries, ablation, and signal-permutation testing
The next discussion added registries for tests, results, signals, interactions, and prediction outcomes, plus staged ablation/permutation tests. The user explicitly wanted to remove one signal at a time and rerun so the model could identify which signals actually changed the result. The assistant proposed integrating those registries and ablation/permutation logic into the full simulator and running a compact pass.

The user's literal authorization included: `Correct. Now, go ahead ... make the additions to the full entire code, and then let it keep running.` The resulting execution cell is a descendant of both prior execution nodes and is preserved as `run_03.py`.

Causal change: the process moved from “does the model score well?” to “which mechanism changes the score, and does the prediction survive removal/permutation?” This is a methodological hardening step, not just another optimization round.