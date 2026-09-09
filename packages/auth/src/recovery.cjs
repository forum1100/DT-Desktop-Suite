const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { ADMIN_SCOPES } = require('./policy.cjs');

class RecoveryAuthority {
  constructor(root, keys, ownerLogin) {
    this.file = path.join(root, 'recovery-registry.json');
    this.keys = keys;
    this.ownerLogin = ownerLogin;
    fs.mkdirSync(root, { recursive: true });
  }
  load() { return fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : []; }
  save(rows) { fs.writeFileSync(this.file, JSON.stringify(rows, null, 2), 'utf8'); }
  issuePair(label = 'owner-escrow') {
    return [1, 2].map(slot => this.issue(`${label}-${slot}`));
  }
  issue(label) {
    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(24).toString('base64url');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(secret, salt, 32).toString('hex');
    const rows = this.load();
    rows.push({ id, label, salt, hash, ownerLogin: this.ownerLogin, createdAt: new Date().toISOString(), usedAt: null });
    this.save(rows);
    return { id, ticket: `dtr_${id}.${secret}`, ownerLogin: this.ownerLogin, uses: 1 };
  }

  redeem(ticket, authenticatedGithubLogin) {
    if (authenticatedGithubLogin !== this.ownerLogin) throw new Error('Owner GitHub verification required');
    const match = /^dtr_([^.]+)\.(.+)$/.exec(ticket || '');
    if (!match) throw new Error('Invalid recovery ticket');
    const rows = this.load();
    const record = rows.find(row => row.id === match[1]);
    if (!record || record.usedAt) throw new Error('Recovery ticket unavailable');
    const hash = crypto.scryptSync(match[2], record.salt, 32).toString('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(record.hash))) throw new Error('Invalid recovery ticket');
    record.usedAt = new Date().toISOString();
    this.save(rows);
    return this.keys.issue({ label: `recovered-owner:${this.ownerLogin}`, scopes: [...ADMIN_SCOPES] });
  }
}
module.exports = { RecoveryAuthority };
