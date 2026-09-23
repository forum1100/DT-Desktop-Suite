const test = require('node:test');
const assert = require('node:assert/strict');
const { DESKTOP_STORAGE_POLICY, WEBSITE_STORAGE_POLICY } = require('../packages/core/src/storage-policy.cjs');

test('desktop is the durable household system of record', () => {
  assert.equal(DESKTOP_STORAGE_POLICY.persistence, 'DURABLE_BY_DEFAULT');
  assert.equal(DESKTOP_STORAGE_POLICY.closeDeletesUserData, false);
  assert.equal(DESKTOP_STORAGE_POLICY.windowCloseKeepsKernelResident, true);
  assert.equal(DESKTOP_STORAGE_POLICY.deletionRequiresExplicitAuthenticatedAction, true);
});

test('website remains an ephemeral client lifecycle', () => {
  assert.equal(WEBSITE_STORAGE_POLICY.persistence, 'MINIMIZED_CLIENT_STATE');
  assert.equal(WEBSITE_STORAGE_POLICY.closeDeletesSensitiveSessionData, true);
  assert.equal(WEBSITE_STORAGE_POLICY.serverOfRecord, false);
});
