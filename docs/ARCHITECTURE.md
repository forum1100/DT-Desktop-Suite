# DT Desktop Suite Architecture

Each DT agent is an individually launchable program with:

- a unique stable agent ID and icon;
- a declared purpose and scientific-status label;
- explicit input and output schemas;
- least-privilege capabilities;
- a private local workspace and append-only event log;
- consumer-selected AI provider access;
- the universal safety and hallucination-risk preflight;
- import/export through a portable consumer-owned vault.

Programs share audited runtime packages rather than duplicating security-critical code.

## Runtime topology

1. **Desktop shell** launches the suite or one named agent.
2. **Agent registry** loads only declared modules.
3. **Local broker** validates and records inter-agent envelopes.
4. **Vault** stores versioned records and checkpoints.
5. **Provider gateway** calls OpenAI, Anthropic, xAI, Ollama, or a compatible endpoint.
6. **Safety stack** evaluates promotion boundaries before output is exported.
7. **Export layer** creates portable, provenance-bearing bundles.

An agent cannot delete another agent's history or inherit its authority merely because both use the same provider.
