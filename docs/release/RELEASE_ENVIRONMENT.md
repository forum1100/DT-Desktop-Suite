# DT Desktop Suite 0.3.0 — Reproducible Environment

Status: VERIFIED LOCAL BUILD INPUT

- Windows build host: Windows build 26200
- Node.js: v24.19.0
- npm: 11.17.0
- Python: 3.13.15 (support tooling only; Desktop app is Node/Electron)
- Electron: 44.4.3
- Package manager lock: `package-lock.json`
- package-lock SHA-256: `349A033A2563CB2BDB3E3D2D7D779CB0DD570596F28DAEE89E380C6EFED458AB` before the 0.3.0/Electron update; final release hash is recorded by the release receipt.
- Install command: `npm ci`
- Test command: `npm test`
- Windows build command: `npm run build:win`

Reproducibility rule: release validation must begin from a clean source copy without `node_modules` or prior `dist*` outputs, run `npm ci`, run the complete test suite, then build. A passing working-tree build alone is insufficient.
## Final 0.3.0 lock state
- package-lock SHA-256: `DF18FAFD26EC038CFD0EB013CBC265C0E225C7B1D40A9C8EED4D17C29345559B`
- package.json SHA-256: `98082894CFF102ED221E09C36F8C71007BF2E55AA28522E6263BBAE45FF3DCFF`
- Clean-room `npm ci`: PASS
- Clean-room `npm audit`: 0 vulnerabilities
- Clean-room tests: 75/75 PASS
- Clean-room Windows build: PASS