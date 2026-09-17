const fs = require('node:fs');
const path = require('node:path');

class AdapterStatusRegistry {
  constructor(root) {
    this.root = path.join(root, 'adapters');
    fs.mkdirSync(this.root, { recursive: true });
  }

  file(id) {
    const safe = String(id || '').replace(/[^a-z0-9._-]/gi, '_');
    return path.join(this.root, safe + '.json');
  }

  load(id) {
    const file = this.file(id);
    if (!fs.existsSync(file)) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return null; }
  }

  record(id, patch = {}) {
    const prior = this.load(id) || {};
    const row = {
      schema: 'dt-adapter-status/1.0',
      ...prior,
      ...patch,
      id,
      updatedAt: new Date().toISOString()
    };
    const file = this.file(id);
    const temp = file + '.tmp';    fs.writeFileSync(temp, JSON.stringify(row, null, 2), 'utf8');
    fs.renameSync(temp, file);
    return row;
  }

  list() {
    return fs.readdirSync(this.root)
      .filter(name => name.endsWith('.json'))
      .map(name => this.load(name.slice(0, -5)))
      .filter(Boolean);
  }
}

function summarizeAdapterState({ credentialStored = false, providerProof = null,
  cliProof = null, peerConnected = false, standingLease = false } = {}) {
  return Object.freeze({
    implementation: 'IMPLEMENTED',
    implementationComplete: true,
    credentialStored: Boolean(credentialStored),
    providerConnectivity: providerProof?.outcomeVerified || providerProof?.status === 'PONG_RECEIVED'
      ? 'VERIFIED_REACHABLE' : 'UNVERIFIED',
    commandPath: cliProof?.outcomeVerified ? 'VERIFIED_END_TO_END' : 'UNVERIFIED',
    peerConnection: peerConnected ? 'CONNECTED' : 'NOT_CONNECTED',
    standingLease: Boolean(standingLease),
    requiresAIForCoreRuntime: false
  });
}

module.exports = { AdapterStatusRegistry, summarizeAdapterState };
