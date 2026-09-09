const { createEnvelope, verifyEnvelope } = require('./protocol.cjs');

class Broker {
  constructor(vault, registry) {
    this.vault = vault;
    this.registry = registry;
  }

  send(input) {
    const message = createEnvelope(input);
    const sender = this.registry.get(message.sender);
    const recipient = this.registry.get(message.recipient);
    if (!sender || !recipient) throw new Error('Unknown sender or recipient');
    if (!sender.canSend.includes(message.type)) throw new Error('Sender lacks message authority');
    if (!recipient.canReceive.includes(message.type)) throw new Error('Recipient rejects message type');
    if (!verifyEnvelope(message)) throw new Error('Envelope integrity failure');
    this.vault.append('agent-message', message.sender, message);
    return message;
  }
}
module.exports = { Broker };
