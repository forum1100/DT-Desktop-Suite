const test = require('node:test');
const assert = require('node:assert/strict');
const { createLocalUser, verifyPassword, verifyRecovery } = require('../packages/auth/src/local-user.cjs');

test('local user credentials hash password and issue one recovery code', () => {
  const created = createLocalUser({ username:'test.user', password:'correct horse battery staple' });
  assert.equal(created.record.username, 'test.user');
  assert.equal(created.record.passwordHash.includes('correct horse'), false);
  assert.match(created.recoveryCode, /^[A-F0-9]{6}(?:-[A-F0-9]{6}){5}$/);
  assert.equal(verifyPassword(created.record, 'correct horse battery staple'), true);
  assert.equal(verifyPassword(created.record, 'wrong password'), false);
  assert.equal(verifyRecovery(created.record, created.recoveryCode), true);
});

test('local user auth rejects weak credentials', () => {
  assert.throws(() => createLocalUser({ username:'x', password:'short' }));
  assert.throws(() => createLocalUser({ username:'validname', password:'short' }));
});
