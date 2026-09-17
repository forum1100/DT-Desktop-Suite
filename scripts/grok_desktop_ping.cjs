const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { providerDefinition, requestAI } = require('../packages/providers/src/index.cjs');

const NONCE = 'GROK-PING-20260916T2226EDT-COFFEEMAKER3737';
const syncRoot = 'C:\\DT\\GoogleDrive\\My Drive\\GROK_DT_SYNC';
const receiptName = '20260917T_CURRENT__GROK_SYNC__COFFEEMAKER_PROVIDER_PING__RECEIPT.md';
const credRoot = path.join(process.env.APPDATA, 'dt-desktop-suite', 'dt-vault', 'credentials');

async function main() {
  await app.whenReady();
  const credentialPath = ['xai.bin', 'compatible.bin'].map(n => path.join(credRoot, n)).find(fs.existsSync);
  if (!credentialPath) throw new Error('No encrypted xAI-compatible credential available');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows safeStorage unavailable');
  const apiKey = safeStorage.decryptString(fs.readFileSync(credentialPath));
  const definition = providerDefinition('xai');
  let responseText = null, error = null;
  try {
    const response = await requestAI(definition, {
      apiKey, model: 'grok-4',
      system: 'Return exactly PONG and nothing else.',
      messages: [{ role: 'user', content: NONCE }]
    });
    responseText = String(response.text || '').trim();
  } catch (e) { error = e.message || String(e); }
  const status = responseText === 'PONG' ? 'PONG_RECEIVED' : 'NOT_CONNECTED';
  const receipt = [
    '# COFFEEMAKER PROVIDER PING RECEIPT',
    '',
    `- Source: GPT-desktop-root`,
    `- Device: CoffeeMaker3737`,
    `- Provider adapter: xai via DT Desktop Suite`,
    `- Model: grok-4`,
    `- Nonce: ${NONCE}`,
    `- Response: ${responseText || '(none)'}`,
    `- Status: ${status}`,
    `- Error: ${error || '(none)'}`,
    `- Credential material included: false`,
    `- Canonical claimed: false`,
    `- HVAC: PARKED`,
    `- Created: ${new Date().toISOString()}`
  ].join('\n');
  const file = path.join(syncRoot, receiptName);
  fs.writeFileSync(file, receipt, 'utf8');
  const sha256 = crypto.createHash('sha256').update(receipt).digest('hex');
  console.log(JSON.stringify({ file, status, response: responseText, error, sha256 }, null, 2));
  app.quit();
}

main().catch(err => { console.error(err.stack || String(err)); app.exit(1); });
