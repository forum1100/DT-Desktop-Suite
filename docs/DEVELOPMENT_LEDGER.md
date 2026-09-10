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

## 2026-09-09 — Private capability reconciliation: release and registry controls

The private architecture confirmed two additional missing operational structures: the Public Release Gate and Artifact Registry. The successor release gate performs supplemental secret and prohibited-claim pattern checks without returning suspected secret text, then requires explicit provenance, confidentiality, disclosure, licensing, claim, IP, and owner-approval gates. It cannot replace manual review.

The successor artifact registry validates stable identity and SHA-256 form, preserves creator, contributor, source, confidentiality, disclosure, licensing, parent, and derivative fields, and refuses overwrite semantics. These tools implement the documented architecture without copying private test catalogs or private case content into the transferable package.

## 2026-09-09 — Private capability reconciliation: service credits and adversarial testing

The DT Evaluation Credit Ledger was restored as a non-transferable internal service unit. It accepts only nonzero integer entries, prevents negative balances, preserves actor, reason, and reference, and explicitly disclaims cryptocurrency, ownership, revenue share, cash value, and guaranteed redemption. Durable receipts remain append-only vault events.

The Adversarial Test Lab was restored as a design-only synthetic security workbench covering the archived test families. A case requires explicit authority, isolation, synthetic fixtures, prediction, falsification, expected behavior, stop conditions, evidence plan, and environment. It grants no execution authority and prohibits real secrets and third-party targets.

## 2026-09-09 — Foundry lifecycle reconciliation and closeout agents

- Recovered and read the controlling Drive records for AFM-001, Agent Master,
  birth/descent, current action topology, architecture delta, and tool dependencies.
- Added eleven desktop closeout workspaces: source discovery, ingestion, verbatim
  archive, derived model, export, divergence, branch, index, completion, Foundry,
  and DT Closeout.
- Added executable local Foundry contract storage for identities, authority grants,
  bounded parent/child packets, qualification gates, residuals, and legal lifecycle
  transitions.
- Reconciled 19 identities. AFM-001 and governing offices remain dormant;
  source-defined employees remain specified-only; new local processes remain
  implementation candidates pending role mapping and qualification.
- Preserved the invariant that information transfer does not transfer authority.
- Validation covers packet completeness, staged promotion, mandatory RUNNING gates,
  open-residual blocking, source gaps, and refusal of self-promotion.
- Protected archive boundary remains read-only and unchanged.

## 2026-09-09 — Live operations observatory and suite release governance

- Added live whole-suite and selected-agent views for observed local runtime activity.
- Records run duration, input/output byte counts, success/failure, last run, suite uptime,
  and current in-process activity in the append-only consumer vault.
- Added Agent Operations Historian for evidence-bounded efficiency, retry, idle-gap,
  bottleneck, and concurrency recommendations; it cannot auto-spawn or mutate agents.
- Added Suite Release Manager for patches, dependencies, tests, security review,
  rollback, release manifests, destination, and explicit owner approval.
- Runtime measurements are labeled as local observations, not model-token billing.

## 2026-09-10 — Governed Desktop Control activation

- Promoted Desktop Control Agent from experimental to operational only after four end-to-end safe-pad tests passed: MOVE, LEFT_CLICK, RIGHT_CLICK, and SCROLL.
- Verified the complete chain: visible task-bound capture, bounded queue, single-use approval, native execution, observed outcome, append-only receipts, video SHA-256, vault-chain validation, portable export, and readback verification.
- Preserved predecessor failures: blank coordinates becoming zero, incomplete queued actions, UIntPtr conversion failure, unobserved click timing, and upward scroll at the top boundary.
- Operational status does not grant typing, macros, unattended control, covert capture, or perpetual authority. Every action still requires active capture and separate runtime approval.
- Full-workflow verifier receipt: session 5be574b7-60cb-4ba4-8d52-25df04a2fcaf; bundle hash 92a79830866d1b003330ee700994aabfdb207b35a388feec3cb5546ba35022a2.

## 2026-09-10 — Agent qualification manager

- Added an individual Agent Qualification Manager program to separate source identity, desktop role, lifecycle state, evidence, gates, residuals, and execution authority.
- Required gates are permissions, Prism security, teach-back, custodian takeover, and runtime testing; missing, failed, pending, or malformed gates block qualification.
- Qualification completion does not start a process, transfer authority, or permit self-promotion. An attributable lifecycle transition remains separately required.
- The three provisional local coordinator processes remain implementation candidates until evaluated against this gate with source-specific evidence.

## 2026-09-10 — Provisional coordinator qualification run

- Corrected Foundry gate evaluation so append-only historical PENDING/FAIL records remain preserved while the latest status per gate governs current eligibility.
- Evaluated LOCAL-CLOSEOUT-MANAGER, LOCAL-CLOSEOUT-WORKER, and LOCAL-ARCHIVE-KNOWLEDGE individually.
- Source reconciliation and runtime-test gates passed for all three using recorded source-role mappings and code hashes.
- Permissions, Prism-security integration, teach-back, and custodian-takeover gates remain PENDING for all three.
- No lifecycle promotion, identity merge, authority transfer, or process start occurred.
- Primary mappings: manager to HCC-001; worker to ATB-001; archive knowledge to HIS-001. Supporting-office relationships remain explicit and non-collapsing.


## 2026-09-10 — Runtime Prism gate for provisional closeout processes

- Added a shared fail-closed `prism_guard.py` boundary.
- Integrated it before Closeout Manager worker launch/task submission, before Closeout Worker handler execution, and before Archive Knowledge resource registration.
- Allowed closeout operations remain limited to hash, scan, slice, and manifest.
- Explicit canonical read/write roots are required; path escape is rejected.
- Credential-bearing fields/values, authority expansion, covert capture, and unsupported task types are rejected without logging credential values.
- Verification: 8 Python Prism tests passed; 44 existing Node regression tests passed.
- Qualification result: PRISM_SECURITY PASS for the three mapped implementation candidates.
- No promotion, authority transfer, custodian takeover, or process activation occurred.
- Remaining gates: PERMISSIONS, TEACH_BACK, and TAKEOVER.
