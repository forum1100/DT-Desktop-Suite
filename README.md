# DT Desktop Suite

A local-first communications hub and collection of individually launchable DT agent programs.

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
