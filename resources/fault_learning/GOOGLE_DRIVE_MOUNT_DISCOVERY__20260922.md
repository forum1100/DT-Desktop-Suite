# DT Desktop Fault Learning — Google Drive Mount Discovery

Status: IMPLEMENTATION_CANDIDATE / LIBRARIAN_RECONCILIATION REQUIRED
Date: 2026-09-22
Incident class: STORAGE_MOUNT_PATH_DRIFT

## BEFORE
DT_CLOSEOUT expected Google Drive at `G:\` from bootstrap configuration.

## OBSERVATION
`G:\` was absent, while `GoogleDriveFS.exe` was already running.
The live Google Drive connector remained functional.
DriveFS preferences/logs showed historical/configured mount references to `G`, but the cleanly restarted client mounted successfully at `C:\DT\GoogleDrive`.

## DECISION
Do not equate missing `G:\` with Google Drive being disconnected.
Treat fixed drive-letter assumptions as a recoverable configuration/path-discovery fault.

## ACTION
Inspected DriveFS process state, preferences and logs.
Detected duplicate/stale IPC ownership during relaunch attempts.
Performed controlled DriveFS restart.
Re-read startup log and discovered successful mount at `C:\DT\GoogleDrive`.

## RESULT
Google Drive filesystem is available at `C:\DT\GoogleDrive`.
`My Drive` is readable through the desktop-mounted filesystem.
The failure was path drift plus stale/duplicate process state, not a missing account connection.

## VALIDATION
DriveFS log: filesystem mounted successfully at `C:\DT\GoogleDrive` and core startup completed OK.
Desktop filesystem read of `C:\DT\GoogleDrive\My Drive` succeeded.

## LEARNED RULE
DT Desktop storage clients must discover and validate the active mount path at runtime before declaring storage unavailable. A configured drive letter is a hint, not proof.

## RECOVERY ORDER
1. Test configured path.
2. Detect active sync client processes.
3. Inspect provider preferences/logs for current mount target.
4. Detect stale/duplicate IPC/process state.
5. Perform controlled restart only when justified.
6. Re-discover actual mount path.
7. Validate filesystem access with a real read.
8. Update session-scoped routing to the live path.
9. Preserve path drift as fault-learning evidence.
10. Do not self-canonicalize; Librarian/governance decides promotion.
