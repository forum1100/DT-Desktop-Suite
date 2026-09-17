const PLUGIN_ID = 'grok-remote-cli';

const manifest = Object.freeze({
  schema: 'dt-plugin/1.0',
  id: PLUGIN_ID,
  name: 'Grok Remote CLI',
  version: '1.0.0',
  provider: 'xai',
  executiveId: 'grok-ceo',
  gatewayAuthority: 'DT_PLATFORM',
  capability: 'command.execute',
  transport: 'github-temporary-mailbox',
  executionBackend: 'TJ_Command_Bridge',
  automaticRiskLevel: 'SAFE_AUTOMATIC',
  ownerApprovalForOtherCommands: true,
  requiresActiveVisibleCapture: true,
  requiresVerifiedPeerConnection: true,
  standingLease: false,
  credentialExposure: false
});

function activationState(context = {}) {
  const reasons = [];
  if (context.peerConnected !== true) reasons.push('GROK_PEER_NOT_VERIFIED_CONNECTED');
  if (context.activeCapture !== true) reasons.push('ACTIVE_VISIBLE_CAPTURE_REQUIRED');
  if (context.ownerVerified !== true) reasons.push('OWNER_IDENTITY_NOT_VERIFIED');
  if (context.bridgeAvailable !== true) reasons.push('TJ_COMMAND_BRIDGE_UNAVAILABLE');
  return Object.freeze({
    pluginId: PLUGIN_ID,
    installed: true,
    active: reasons.length === 0,
    mode: reasons.length === 0 ? 'READY_SAFE_AUTOMATIC' : 'DORMANT',
    reasons,
    manifest
  });
}

module.exports = { PLUGIN_ID, manifest, activationState };
