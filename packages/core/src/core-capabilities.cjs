const fs = require('node:fs');
const path = require('node:path');

function underRoots(target, roots) {
  const resolved = path.resolve(String(target || ''));
  return roots.some(root => {
    const base = path.resolve(root);
    return resolved === base || resolved.startsWith(base + path.sep);
  });
}

function registerCoreCapabilities(bus, context = {}) {
  const environment = context.environment || {};
  const roots = [environment.home,
    ...(environment.googleDrive || []).map(item => item.root),
    ...(context.extraRoots || [])].filter(Boolean);

  bus.register({
    id: 'system.environment', description: 'Read DT bootstrap and machine discovery state.',
    risk: 'READ_ONLY'
  }, async () => environment);

  bus.register({
    id: 'google_drive.roots', description: 'List Google Drive roots detected on this installation.',
    risk: 'READ_ONLY', hardwareClass: 'storage'
  }, async () => environment.googleDrive || []);
  bus.register({
    id: 'filesystem.list', description: 'List a local directory under DT-authorized roots.',
    risk: 'READ_ONLY', hardwareClass: 'storage'
  }, async input => {
    const target = path.resolve(String(input.path || environment.home || '.'));
    if (!underRoots(target, roots)) throw new Error('Path outside DT-authorized roots');
    return fs.readdirSync(target, { withFileTypes: true }).map(item => ({
      name: item.name, type: item.isDirectory() ? 'directory' : item.isFile() ? 'file' : 'other'
    }));
  });

  bus.register({
    id: 'filesystem.read', description: 'Read a bounded UTF-8 text file under DT-authorized roots.',
    risk: 'READ_ONLY', hardwareClass: 'storage'
  }, async input => {
    const target = path.resolve(String(input.path || ''));
    if (!underRoots(target, roots)) throw new Error('Path outside DT-authorized roots');
    const stat = fs.statSync(target);
    if (!stat.isFile()) throw new Error('Target is not a file');
    const maxBytes = Math.max(1, Math.min(4 * 1024 * 1024, Number(input.maxBytes) || 1024 * 1024));
    const fd = fs.openSync(target, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, maxBytes));
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
      return { path: target, bytes, truncated: stat.size > bytes, text: buffer.subarray(0, bytes).toString('utf8') };
    } finally { fs.closeSync(fd); }
  });

  bus.register({
    id: 'powershell.run', description: 'Run a bounded DT-governed PowerShell command headlessly.',
    risk: 'DYNAMIC', hardwareClass: 'computer'
  }, async (input, callContext) => {
    const result = context.runHeadlessCommand({
      command: String(input.command || ''),
      cwd: String(input.cwd || environment.home || ''),
      timeoutSeconds: Number(input.timeoutSeconds) || 120
    }, input.variables || {}, {
      ownerApproved: callContext.ownerApproved === true,
      defaultCwd: environment.home,
      allowedRoots: roots
    });
    context.experience?.append('headless-command', {
      command: result.command, cwd: result.cwd, exitCode: result.exitCode,
      stdout: result.stdout, stderr: result.stderr, success: result.exitCode === 0
    }, { capability: 'powershell.run' });
    if (result.exitCode !== 0 || result.error) {
      context.residentRuntime?.submitIncident({
        source: 'powershell.run', command: result.command, cwd: result.cwd,
        exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, error: result.error
      });
    }
    return result;
  });

  bus.register({
    id: 'runtime.status', description: 'Read resident DT worker/runtime status.',
    risk: 'READ_ONLY'
  }, async () => context.residentRuntime?.status() || { running: false });

  bus.register({
    id: 'runtime.submit_incident', description: 'Submit a DT incident for background diagnosis.',
    risk: 'LOCAL_MUTATION'
  }, async input => context.residentRuntime?.submitIncident(input || {}) || null);

  return { roots, capabilities: bus.list() };
}

module.exports = { registerCoreCapabilities, underRoots };
