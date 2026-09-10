const PEER_EXECUTIVES = Object.freeze({
  'chatgpt-ceo': Object.freeze({
    id: 'chatgpt-ceo', provider: 'openai', standing: 'PEER_EXECUTIVE',
    gatewayAuthority: 'DT_PLATFORM'
  }),
  'grok-ceo': Object.freeze({
    id: 'grok-ceo', provider: 'xai', standing: 'PEER_EXECUTIVE',
    gatewayAuthority: 'DT_PLATFORM'
  })
});

function getPeerExecutive(id) {
  return PEER_EXECUTIVES[String(id || '')] || null;
}

function listPeerExecutives() {
  return Object.values(PEER_EXECUTIVES).map(peer => ({ ...peer }));
}

module.exports = { PEER_EXECUTIVES, getPeerExecutive, listPeerExecutives };
