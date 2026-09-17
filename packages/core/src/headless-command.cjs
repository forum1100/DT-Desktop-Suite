const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { commandRisk } = require('./grok-command.cjs');

function renderTemplate(text, input = {}) {
  return String(text || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key) => {
    const value = key.split('.').reduce((current, part) => current?.[part], input);
    if (value === undefined || value === null) throw new Error(`Missing command template input: ${key}`);
    return String(value);
  });
}

function runHeadlessCommand(step = {}, input = {}, context = {}) {
  const command = renderTemplate(step.command, input).trim();
  const risk = commandRisk(command);
  if (risk.level === 'BLOCKED') throw new Error('DT blocked learned command: ' + risk.reason);
  if (risk.level !== 'SAFE_AUTOMATIC' && context.ownerApproved !== true) {
    throw new Error('Owner approval required for learned command');
  }
  const cwd = path.resolve(renderTemplate(step.cwd || context.defaultCwd || process.cwd(), input));
  const roots = (context.allowedRoots || []).map(root => path.resolve(root));
  if (roots.length && !roots.some(root => cwd === root || cwd.startsWith(root + path.sep))) {
    throw new Error('Learned command cwd is outside DT-authorized roots');
  }
  const timeout = Math.max(1000, Math.min(900000, (Number(step.timeoutSeconds) || 120) * 1000));
  const proc = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
    cwd,
    windowsHide: true,
    encoding: 'utf8',
    timeout,
    maxBuffer: 1024 * 1024 * 4
  });
  return {
    command,
    cwd,
    risk,
    exitCode: Number.isInteger(proc.status) ? proc.status : null,
    stdout: String(proc.stdout || ''),
    stderr: String(proc.stderr || ''),
    error: proc.error ? String(proc.error.message || proc.error) : null,
    hiddenWindow: true,
    completedAt: new Date().toISOString()
  };
}

module.exports = { renderTemplate, runHeadlessCommand };
