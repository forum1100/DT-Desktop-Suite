const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { discoverEnvironment } = require('./environment-discovery.cjs');

class DTBootstrap {
  constructor(root) {
    this.root = path.join(root, 'bootstrap');
    this.deviceFile = path.join(this.root, 'device.json');
    this.stateFile = path.join(this.root, 'state.json');
    fs.mkdirSync(this.root, { recursive: true });
  }

  deviceIdentity() {
    if (fs.existsSync(this.deviceFile)) return JSON.parse(fs.readFileSync(this.deviceFile, 'utf8'));
    const identity = {
      schema: 'dt-device/1.0', deviceId: crypto.randomUUID(),
      createdAt: new Date().toISOString(), originAuthority: 'LOCAL_INSTALLATION'
    };
    fs.writeFileSync(this.deviceFile, JSON.stringify(identity, null, 2), 'utf8');
    return identity;
  }

  run() {
    const identity = this.deviceIdentity();
    const environment = discoverEnvironment();
    const state = { schema: 'dt-bootstrap/1.0', identity, environment,
      externalAIRequired: false, completedAt: new Date().toISOString() };
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
    return state;
  }
}

module.exports = { DTBootstrap };
