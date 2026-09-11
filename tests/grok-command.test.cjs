const test = require('node:test');
const assert = require('node:assert/strict');
const { createGrokProposal } = require('../packages/core/src/peer-mailbox.cjs');
const { commandRisk, prepareGrokCommand, commandProposalWasConsumed } = require('../packages/core/src/grok-command.cjs');

const captureSessionId = '22222222-2222-4222-8222-222222222222';
const roots = ['C:\\Users\\thoma\\Documents'];

function proposal(command, cwd = roots[0]) {
  return createGrokProposal({
    executiveId: 'grok-ceo', provider: 'xai', sessionId: 'grok-ceo',
    captureSessionId, capability: 'command.execute', payload: { command, cwd, timeoutSeconds: 30 }
  });
}

test('safe read/build/test commands can pass without per-command owner approval', () => {
  assert.equal(commandRisk('git status').level, 'SAFE_AUTOMATIC');
  const prepared = prepareGrokCommand(proposal('git status'), {
    ownerApproved: false, dtAuthenticated: true, activeCaptureSessionIds: [captureSessionId],
    allowedRoots: roots, defaultCwd: roots[0]
  });
  assert.equal(prepared.accepted, true);
  assert.equal(prepared.prism.approvalRequired, false);
  assert.equal(prepared.envelope.capability, 'command.execute');
});
test('unknown mutating commands require explicit owner approval', () => {
  const p = proposal('git add README.md');
  const refused = prepareGrokCommand(p, {
    ownerApproved: false, dtAuthenticated: true, activeCaptureSessionIds: [captureSessionId],
    allowedRoots: roots, defaultCwd: roots[0]
  });
  assert.equal(refused.accepted, false);
  assert.equal(refused.reason, 'OWNER_SINGLE_USE_APPROVAL_REQUIRED');
  const allowed = prepareGrokCommand(p, {
    ownerApproved: true, dtAuthenticated: true, activeCaptureSessionIds: [captureSessionId],
    allowedRoots: roots, defaultCwd: roots[0]
  });
  assert.equal(allowed.accepted, true);
});

test('destructive or privilege-changing commands remain hard-blocked', () => {
  assert.equal(commandRisk('git reset --hard HEAD~1').level, 'BLOCKED');
  assert.equal(commandRisk('shutdown /s /t 0').level, 'BLOCKED');
  const denied = prepareGrokCommand(proposal('git reset --hard HEAD~1'), {
    ownerApproved: true, dtAuthenticated: true, activeCaptureSessionIds: [captureSessionId],
    allowedRoots: roots, defaultCwd: roots[0]
  });
  assert.equal(denied.accepted, false);
});
test('command proposals remain capture-bound and single-use', () => {
  const p = proposal('git status');
  const inactive = prepareGrokCommand(p, {
    ownerApproved: false, dtAuthenticated: true, activeCaptureSessionIds: [],
    allowedRoots: roots, defaultCwd: roots[0]
  });
  assert.equal(inactive.reason, 'CAPTURE_SESSION_NOT_ACTIVE');
  assert.equal(commandProposalWasConsumed([], p.proposalHash), false);
  assert.equal(commandProposalWasConsumed([
    { kind: 'grok-peer-command-consumed', data: { proposalHash: p.proposalHash } }
  ], p.proposalHash), true);
});