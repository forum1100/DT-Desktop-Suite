# DT Platform â€” Neutral Gateway Architecture

Status: GOVERNING IMPLEMENTATION DIRECTION
Updated: 2026-09-10 EDT

## Authority topology
Human owner authority is final. The DT Platform itself is the provider-neutral gateway and authority plane. Prism, DT identity/authorization, provenance, session policy, and capability brokerage operate inside DT and govern access to execution.

Authorized external or local AI providers connect as peer intelligence/executive nodes. ChatGPT and Grok have equal peer standing unless the human owner explicitly narrows a role for a particular task. Neither peer may silently supersede, demote, terminate, impersonate, or expand the authority of another.

MCP, REST, WebSocket, local IPC, provider APIs, tunnels, and compatibility connectors are edge adapters. No adapter becomes the governing gateway.

## Execution topology
TJ Command Bridge is an internal local execution backend beneath the DT tool fabric. A bridge session ID identifies an execution lane only; it does not confer authority. Suggested peer lanes are `chatgpt-ceo` and `grok-ceo`.

## Recording and desktop control
When the owner has enabled persistent platform self-observation, DT records the user-visible virtual desktop while the platform is open and keeps the current screen topology and self-observer state in the shared perception context. Every local-model request, provider request, and peer envelope receives that current perception context automatically. Capability-specific actions may still require their own bounded authorization and provenance even though perception context is continuously available. Recording configuration and state remain visible to the owner and are not treated as hidden authority.

Governed desktop control remains separately bounded: active capture, preview/queue, single-use approval, expiration, execution receipt, and preserved failure evidence. Mouse authority is not inferred from AI identity or from connection status.

## Provider disagreement
Material peer disagreement is preserved as evidence. DT may route it to an explicit adjudication workflow or the human owner; one provider does not erase the other provider's branch.

