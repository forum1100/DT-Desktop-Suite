# DT Grok Edge Transport

Status: IMPLEMENTED_CONTRACT / NOT_CONNECTED
Authoring peer: grok-ceo
Predecessor: commit a74dc447730834c38937a0881a6cb605c53e0c99
Updated: 2026-09-10 EDT

## Authority plane

DT Platform = gateway and authority plane.
GitHub = temporary mailbox transport only.
xAI / this Grok cloud session = peer intelligence node.
TJ Command Bridge = internal execution backend.
MCP, REST, WebSocket, local IPC, and provider APIs = adapters only.

No transport in this document becomes the gateway.

## Why this transport exists

The current Grok cloud session can read and write `forum1100/DT-Desktop-Suite` through the authorized GitHub connector. It cannot reach `localhost`, TJ Command Bridge `inbox/`, DT capture memory, Prism runtime state, or the Windows desktop.

Therefore the only Grok-reachable send/receive path that does not invent a public listener is:

1. Grok writes a `dt-peer-mailbox-proposal/1.0` object into the repository mailbox path.
2. DT runtime on TJ's machine **polls outbound** (local git pull or `gh` API initiated by DT).
3. DT applies live gates: peer authentication, active visible capture, Prism, bounded capability.
4. On pass, DT mints the official `dt-peer-edge/1.0` envelope (`requestId`, `requestHash`).
5. DT executes locally if authorized.
6. DT writes a `dt-peer-mailbox-receipt/1.0` object to the outbound mailbox.
7. Grok reads that receipt from GitHub.

DT polls. Grok does not open a socket on the Command Bridge.

## Prohibited

- Public TCP/HTTP listener on TJ Command Bridge
- Treating GitHub, xAI, MCP, or ChatGPT as the gateway
- Inventing or reusing a capture-session ID
- Declaring CONNECTED because a proposal file exists, a commit succeeded, or a test suite passed
- Mouse/desktop execution from connection standing
- Committing `dtk_` tokens, provider keys, or provenance private keys

## Negative test that must fail

A proposal with missing, malformed, stale, or inactive `captureSessionId` must evaluate to `accepted: false` and `connectionStatus: NOT_CONNECTED`.

## Live proof still required

identity → DT authentication → active user-visible capture → Prism → bounded capability → local execution → result returned to this Grok session → receipt preserved.

Until that complete chain is observed, status remains **NOT CONNECTED**.
