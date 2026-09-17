const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Vault } = require('../packages/core/src/vault.cjs');
const { verifyEntries } = require('../packages/core/src/portable.cjs');

function runWriter(root, tag) {
  const vaultPath = path.resolve(__dirname, '../packages/core/src/vault.cjs');
  const code = `const {Vault}=require(${JSON.stringify(vaultPath)});const v=new Vault(${JSON.stringify(root)});for(let i=0;i<25;i++)v.append('concurrency-test',${JSON.stringify(tag)},{i});`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', code], { stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`writer ${tag} exited ${code}`)));
  });
}

test('vault serializes concurrent cross-process appends', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-vault-lock-'));
  try {
    await Promise.all([runWriter(root, 'A'), runWriter(root, 'B'), runWriter(root, 'C')]);
    const entries = new Vault(root).all();
    assert.equal(entries.length, 75);
    assert.deepEqual(verifyEntries(entries), { valid: true, count: 75, headHash: entries.at(-1).hash });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
