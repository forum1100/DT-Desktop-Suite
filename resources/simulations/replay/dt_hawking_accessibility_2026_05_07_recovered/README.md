# DT Hawking Accessibility Toy Simulation — Recovered Historical Replay

Status: `VERBATIM_EXECUTED_CODE_RECOVERED / REPLAYED`

This pack contains the exact Python cells preserved in a May 2026 ChatGPT export for the historical DT Hawking-accessibility toy simulation. The cells are source-faithful recoveries from recorded code-execution metadata, not a later reconstruction.

The historical sequence includes an initial horizon toy model, an ablation model, a stricter anti-saturation revision, and a final threshold-adjusted run. `replay.py` executes the recovered cells in their original sequence and writes `replay_result.json`.

Scientific status: this is a toy/meta-model. It does not derive Hawking radiation from GR/QFT, does not validate DT, and should not be represented as physical confirmation. Its evidentiary value is that the simulation was actually executed historically and is now replayable from recovered source.

Historical final-run headline values include a Full-DT escaped-flux proxy of about 5.78787 and 715.77294 horizon-event proxy units. Ablations are preserved because they expose model dependence rather than proving mechanism.

Run:

```bash
python replay.py
```

Dependencies: Python, NumPy, pandas.
