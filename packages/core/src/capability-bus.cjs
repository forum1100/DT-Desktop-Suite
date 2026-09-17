const crypto = require('node:crypto');

class CapabilityBus {
  constructor({ vault = null } = {}) {
    this.vault = vault;
    this.capabilities = new Map();
  }

  register(definition, handler) {
    if (!definition?.id || typeof handler !== 'function') throw new Error('Capability id and handler required');
    const row = Object.freeze({
      id: String(definition.id),
      description: String(definition.description || ''),
      inputSchema: definition.inputSchema || {},
      risk: definition.risk || 'READ_ONLY',
      hardwareClass: definition.hardwareClass || null,
      requiresOwnerApproval: definition.requiresOwnerApproval === true
    });
    this.capabilities.set(row.id, { definition: row, handler });
    return row;
  }

  list() { return [...this.capabilities.values()].map(item => item.definition); }

  has(id) { return this.capabilities.has(String(id)); }

  async call(id, input = {}, context = {}) {
    const item = this.capabilities.get(String(id));
    if (!item) throw new Error(`Unknown DT capability: ${id}`);
    if (item.definition.requiresOwnerApproval && context.ownerApproved !== true) {
      throw new Error(`Owner approval required for capability ${id}`);
    }
    const callId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    try {
      const output = await item.handler(input, context);
      this.vault?.append('capability-call', 'dt-capability-bus', {
        callId, capabilityId: item.definition.id, startedAt,
        completedAt: new Date().toISOString(), success: true,
        input, output
      });
      return { callId, capability: item.definition, output };
    } catch (error) {
      this.vault?.append('capability-call', 'dt-capability-bus', {
        callId, capabilityId: item.definition.id, startedAt,
        failedAt: new Date().toISOString(), success: false,
        input, error: String(error.message || error)
      });
      throw error;
    }
  }
}

module.exports = { CapabilityBus };
