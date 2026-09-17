const test = require('node:test');
const assert = require('node:assert/strict');
const { manifest, activationState } = require('../packages/plugins/grok-remote-cli/index.cjs');

test('Grok Remote CLI plugin manifest preserves DT authority and bounded execution', () => {
  assert.equal(manifest.id, 'grok-remote-cli');
  assert.equal(manifest.gatewayAuthority, 'DT_PLATFORM');
  assert.equal(manifest.capability, 'command.execute');
  assert.equal(manifest.standingLease, false);
  assert.equal(manifest.credentialExposure, false);
  assert.equal(manifest.requiresActiveVisibleCapture, true);
  assert.equal(manifest.requiresVerifiedPeerConnection, true);
});

test('plugin stays dormant until all live gates are present', () => {
  const dormant = activationState({ peerConnected: false, activeCapture: true, ownerVerified: true, bridgeAvailable: true });
  assert.equal(dormant.active, false);
  assert.ok(dormant.reasons.includes('GROK_PEER_NOT_VERIFIED_CONNECTED'));
  const ready = activationState({ peerConnected: true, activeCapture: true, ownerVerified: true, bridgeAvailable: true });
  assert.equal(ready.active, true);
  assert.equal(ready.mode, 'READY_SAFE_AUTOMATIC');
});
