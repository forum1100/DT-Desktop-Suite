const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { stableHash } = require('../packages/core/src/protocol.cjs');
const { verifyEntries } = require('../packages/core/src/portable.cjs');
const root = path.join(process.env.APPDATA, 'dt-desktop-suite', 'dt-vault');
const log = path.join(root, 'events.jsonl');
const raw = fs.readFileSync(log, 'utf8');
const original = raw.split(/\r?\n/).filter(Boolean).map(JSON.parse);
const check = verifyEntries(original);
if (check.valid) throw new Error('Vault is already linear; refusing reconciliation');
for (const [index, entry] of original.entries()) {
  const { hash, ...body } = entry;
  if (stableHash(body) !== hash) throw new Error(`ENTRY_HASH_MISMATCH_AT_${index}`);
}
const sourceSha256 = crypto.createHash('sha256').update(raw).digest('hex');
const first = check.index;
const rebuilt = original.slice(0, first);
let previousHash = rebuilt.at(-1)?.hash || null;
for (let index = first; index < original.length; index += 1) {
  const entry = original[index];
  const { hash: originalHash, previousHash: originalPreviousHash, ...body } = entry;
  const reconciled = { ...body, previousHash, reconciliation: {
    reason: 'CONCURRENT_APPEND_FORK_RELINEARIZED', sourceIndex: index,
    originalHash, originalPreviousHash, sourceLogSha256: sourceSha256
  }};
  reconciled.hash = stableHash(reconciled);
  rebuilt.push(reconciled); previousHash = reconciled.hash;
}
const finalCheck = verifyEntries(rebuilt);
if (!finalCheck.valid) throw new Error(`RECONCILIATION_FAILED_${finalCheck.reason}_${finalCheck.index}`);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const archived = path.join(root, `events.forked-${stamp}.jsonl`);
fs.writeFileSync(archived, raw, 'utf8');
const next = rebuilt.map(row => JSON.stringify(row)).join('\n') + '\n';
const tmp = log + '.reconciled.tmp';
fs.writeFileSync(tmp, next, 'utf8');
fs.renameSync(tmp, log);
const report = {
  schema: 'dt-vault-fork-reconciliation/1.0', reconciledAt: new Date().toISOString(),
  sourceSha256, originalCount: original.length, firstMismatchIndex: first,
  originalArchive: archived, reconciledCount: rebuilt.length,
  reconciledHeadHash: finalCheck.headHash,
  preservation: 'Every changed record embeds its original hash and previousHash.'
};
fs.writeFileSync(path.join(root, `fork-reconciliation-${stamp}.json`), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
