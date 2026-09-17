const crypto = require('node:crypto');

function normalizeUsername(value) {
  const username = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{3,48}$/.test(username)) throw new Error('Username must be 3-48 letters, numbers, dot, underscore, or dash.');
  return username;
}
function passwordPolicy(password) {
  const value = String(password || '');
  if (value.length < 10) throw new Error('Password must be at least 10 characters.');
  return value;
}
function derive(password, salt) {
  return crypto.scryptSync(passwordPolicy(password), Buffer.from(salt, 'hex'), 32).toString('hex');
}
function hashRecovery(code) {
  return crypto.createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');
}
function recoveryCode() {
  return [...crypto.randomBytes(18)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{1,6}/g).join('-');
}
function createLocalUser({ username, password, signInMode = 'EVERY_LAUNCH' }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const code = recoveryCode();
  return { record: { schema:'dt-local-user/1.0', id:crypto.randomUUID(), username:normalizeUsername(username), salt,
    passwordHash:derive(password, salt), recoveryHash:hashRecovery(code), signInMode,
    createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }, recoveryCode:code };
}
function verifyPassword(record, password) {
  if (!record?.passwordHash || !record?.salt) return false;
  const actual = Buffer.from(derive(password, record.salt), 'hex');
  const expected = Buffer.from(record.passwordHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function verifyRecovery(record, code) {
  const actual = Buffer.from(hashRecovery(code), 'hex');
  const expected = Buffer.from(String(record?.recoveryHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
module.exports = { normalizeUsername, createLocalUser, verifyPassword, verifyRecovery };
