# DT Desktop Suite

A local-first, provider-neutral DT Platform and collection of individually launchable DT agent programs.

## Governing architecture

The DT Platform itself is the neutral gateway. ChatGPT, Grok, local models, and future providers connect as authorized peer intelligence/executive nodes through DT-owned identity, Prism policy, provenance, session, and capability controls. MCP, REST, WebSocket, local IPC, and provider-specific APIs are edge adapters only; none is the platform's governing gateway.

Human owner authority remains above every AI node. No connected provider may silently supersede, demote, terminate, or expand the authority of another peer. Material disagreements are preserved for DT adjudication or owner review.

The TJ Command Bridge is an internal local execution backend beneath DT's tool fabric. It is not the neutral gateway and does not grant authority by itself.

Visible task-bound recording is the required evidence mode for interactive AI work. DT must not perform covert screen capture; recording state, task, agent/provider identity, actions, failures, and resulting evidence remain attributable and locally preserved.

## Current executable agents

- The Librarian
- Hallucination Inspector
- Evidence Mapper
- Branch Retest Lab
- Equation Workbench
- Prediction Lab
- Prism Defense
- Propulsion Conservation
- Civilization Systems
- Consumer Memory Vault
- Execution Telemetry

## Security foundation

The suite issues its own scoped `dtk_` API credentials for agents, automations, devices, and approved clients. External provider credentials remain provider-issued and are stored using operating-system encryption. The owner identity is `forum1100`, verified through GitHub authorization; no GitHub password is embedded.

## Development

```powershell
npm.cmd install
npm.cmd test
npm.cmd start
```

This is an early executable foundation. Scientific and safety status is disclosed per agent, and synthetic execution is never promoted as empirical validation.
