# DT Desktop Suite 0.3.0 — Release Receipt

Status: VERIFIED LOCAL RELEASE / PUBLICATION PENDING

- Working-tree regression suite: 75/75 PASS.
- Clean-room `npm ci`: PASS; `npm audit`: 0 vulnerabilities.
- Clean-room regression suite: 75/75 PASS.
- Clean-room Windows build: PASS.
- Portable artifact SHA-256: `4EA02C7DE0B4160C0C98F01AF05BDC06D6AD29EA29264615185E89055039039C`.
- NSIS installer SHA-256: `F637B073C5B253138C604534B8F7469C1F6BBEF2590264084727E23F2A9C4E13`.
- Installer blockmap SHA-256: `18A057CBA9E026C00295C6F1470134D6DC25584FEC38438AE0920548A9E27340`.
- Existing 0.2.1 Programs executable was preserved as `.pre-0.3.0.bak` before replacement.
- Installed Programs executable SHA-256 equals portable artifact SHA-256: PASS.
- Fresh APPDATA launch from clean release directory: PASS.
- Cold launch from installed Programs path: PASS.
- Live gateway readback: `127.0.0.1:11740` only.
- Vault startup readback records version `0.3.0`: PASS.
- Prior dirty-session recovery export on 0.3.0 startup: PASS and verification recorded in vault.
- Silent NSIS `/S` attempt returned exit code 128 and is preserved as a failed installer path; portable Programs replacement is the verified installation path.
- Literal second-physical-machine validation remains separate from same-host clean-source/fresh-profile reproduction.