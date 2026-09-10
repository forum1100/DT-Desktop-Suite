# DT Black-Hole / Recursive-Learning Historical Execution Pack

Status: `VERBATIM_EXECUTION_CELLS_RECOVERED / PORTABLE_ISOLATED_REPLAY_TESTED`

This pack preserves 18 historically executed simulation cells from the May 2026 DT development conversation, including two historical `KeyboardInterrupt` failures. The failed runs remain failed in historical provenance even though their recovered code now completes when executed in isolated fresh processes.

`RUN_HISTORY.md` records why runs changed: overcorrection, convergence stagnation, selective reopening, microstructure, feature locking, covariance correction, safety-cap exhaustion, Prism computational overload, compressed reruns, hard physical gates, and the failed first topology-inheritance claim.

`replay_run.py` runs one recovered cell using a portability shim that redirects historical `/mnt/data/` output references without modifying the recovered source cell.

Example:

```bash
python replay_run.py --run 8
```

Scientific status: these are toy/proxy/meta-simulations. Replayability validates preservation of the historical computation path; it does not validate the physical claims.