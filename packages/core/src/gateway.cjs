const http = require('node:http');

function createGateway({ keys, vault, broker, agents, port = 11740 }) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    const route = req.method + ' ' + req.url;
    const scope = route === 'GET /v1/agents' ? 'agent:list'
      : route === 'POST /v1/messages' ? 'agent:message'
      : route === 'GET /v1/events' ? 'vault:read' : null;
    if (!scope) { res.writeHead(404); return res.end(JSON.stringify({ error: 'not_found' })); }
    const identity = keys.verify((req.headers.authorization || '').replace(/^Bearer\s+/i, ''), scope);
    if (!identity) { res.writeHead(401); return res.end(JSON.stringify({ error: 'unauthorized' })); }
    try {
      if (route === 'GET /v1/agents') return res.end(JSON.stringify({ agents: agents.list() }));
      if (route === 'GET /v1/events') return res.end(JSON.stringify({ events: vault.all() }));
      let raw = ''; for await (const chunk of req) raw += chunk;
      const message = broker.send(JSON.parse(raw));
      res.writeHead(201); return res.end(JSON.stringify({ message }));
    } catch (error) {
      vault.append('gateway-failure', 'dt-hub', { route, identity: identity.id, error: error.message });
      res.writeHead(400); return res.end(JSON.stringify({ error: error.message }));
    }
  });
  let state = { online: false, shared: false, error: null };
  server.on('listening', () => { state = { online: true, shared: false, error: null }; });
  server.on('error', error => {
    state = { online: false, shared: error.code === 'EADDRINUSE', error: error.code };
    vault.append('gateway-state', 'dt-hub', state);
  });
  return {
    start: () => { server.listen(port, '127.0.0.1'); return state; },
    stop: () => { if (server.listening) server.close(); },
    status: () => ({ ...state }),
    port
  };
}
module.exports = { createGateway };
