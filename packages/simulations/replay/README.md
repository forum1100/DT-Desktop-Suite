# DT Simulation Replay Layer

This directory turns recovered DT simulation work into portable, auditable replay packs. It is intended to be the same simulation surface whether reached from GitHub, a Drive mirror, the DT desktop suite, or another authorized device.

## Principles

- Preserve original source separately from reconstructions.
- Never label a reconstructed executable as the historical source.
- Failed, superseded, and unresolved branches remain in the registry.
- A numerical result is not promoted without executable code, parameters, environment, command, output, and hashes.
- A successful toy/meta-simulation is not physical validation of DT.

## Use

```text
python replay.py --list
python bootstrap.py
.venv/Scripts/python replay.py --run dt_recursive_convergence_2026_05_09_reconstruction
```

On macOS/Linux the virtual-environment interpreter is `.venv/bin/python`.

Each run receives its own `runs/<simulation_id>/<UTC-run-id>/` directory with stdout, stderr, generated outputs, and a `receipt.json` containing execution status and SHA-256 hashes.

## Current black-hole recovery

The May 9 recursive-convergence source has been recovered and contains a `black_hole` domain with explicit persistence/accessibility/constraint features. The PDF extraction contained merged lines, so the runnable copy is labeled `LATER_RECONSTRUCTION`.

A separate Hawking/accessibility experiment is remembered in the project ledger but its exact historical executable has not yet been recovered. The registry therefore preserves it as `NEEDS_EXACT_SOURCE_RECOVERY` rather than silently substituting new code.

## Distribution model

GitHub is the versioned code surface. Drive is the durable mirrored custody surface. DT applications should discover/import this same registry rather than maintaining divergent simulation implementations. Mirrors must retain manifests and hashes so identical artifacts can be verified across surfaces.
