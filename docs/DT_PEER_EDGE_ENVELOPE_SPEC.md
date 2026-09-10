# DT Peer Edge Envelope v1

Status: IMPLEMENTED_CONTRACT / NO_REMOTE_TRANSPORT_AUTHORITY

DT Platform is the provider-neutral gateway. This envelope is an edge contract for authorized peer AI nodes; it does not make MCP, GitHub, xAI, OpenAI, or TJ Command Bridge the gateway.

Registered peer executives:
- `chatgpt-ceo` → provider `openai`
- `grok-ceo` → provider `xai`

Both have standing `PEER_EXECUTIVE` under gateway authority `DT_PLATFORM`. Human owner authority, DT governance, Prism, capture, and provenance remain above both.

Required request fields: `executiveId`, `provider`, `sessionId`, `captureSessionId`, `capability`, bounded `payload`, and expiry. `sessionId` must equal the registered peer identity. Capture-session ID is mandatory. Expiry may not exceed five minutes.

DT generates `requestId`, `createdAt`, standing/gateway fields, and SHA-256 `requestHash` over the complete envelope body.

A valid envelope is only syntactic/integrity evidence. It does NOT establish that the capture session is currently active, Prism approved execution, a DT credential was authorized, the command ran, or the result returned to the originating AI. Those are separate runtime gates.

No live provider credential belongs in this repository. No public TCP listener is added by this contract.

Initial connection proof remains: identity → credential verification → active visible capture → Prism → bounded capability → local execution → result return → receipt → negative tests without capture/authorization.
