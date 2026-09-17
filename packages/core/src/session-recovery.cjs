const fs = require('node:fs');
const path = require('node:path');

function markerPath(root) {
  return path.join(root, 'runtime', 'unclean-session.json');
}
function readDirtySession(root) {
  const file = markerPath(root);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { schema:'dt-dirty-session/1.0', unreadable:true }; }
}
function markSessionDirty(root, metadata = {}) {
  const file = markerPath(root);
  fs.mkdirSync(path.dirname(file), { recursive:true });
  const record = { schema:'dt-dirty-session/1.0', startedAt:new Date().toISOString(), ...metadata };
  fs.writeFileSync(file, JSON.stringify(record, null, 2), 'utf8');
  return record;
}
function clearSessionDirty(root) {
  const file = markerPath(root);
  if (fs.existsSync(file)) fs.rmSync(file, { force:true });
  return !fs.existsSync(file);
}
module.exports = { markerPath, readDirtySession, markSessionDirty, clearSessionDirty };
