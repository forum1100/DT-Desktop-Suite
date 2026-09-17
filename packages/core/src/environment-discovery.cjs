const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

function existingDirectory(value) {
  try { return value && fs.existsSync(value) && fs.statSync(value).isDirectory() ? path.resolve(value) : null; }
  catch { return null; }
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }

function discoverGoogleDrive() {
  const home = os.homedir();
  const candidates = [
    process.env.DT_GOOGLE_DRIVE_ROOT,
    'G:\\My Drive',
    'G:\\Shared drives',
    'C:\\DT\\GoogleDrive\\My Drive',
    path.join(home, 'Google Drive'),
    path.join(home, 'My Drive')
  ];
  const roots = unique(candidates.map(existingDirectory));
  try {
    const ps = "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName | ConvertTo-Json -Compress";
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      encoding: 'utf8', windowsHide: true, timeout: 5000
    }).trim();
    if (raw) {
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      for (const row of rows) {
        if (!/google/i.test(String(row.VolumeName || ''))) continue;
        for (const suffix of ['My Drive', 'Shared drives', '']) {
          const candidate = existingDirectory(path.join(String(row.DeviceID || ''), suffix));
          if (candidate) roots.push(candidate);
        }
      }
    }
  } catch {}
  return unique(roots).map(root => ({
    provider: 'google-drive', root, access: 'LOCAL_FILESYSTEM', detected: true
  }));
}
function discoverExecutables() {
  const commands = ['git', 'gh', 'node', 'npm.cmd', 'python', 'py', 'powershell.exe'];
  const found = [];
  for (const command of commands) {
    try {
      const probe = process.platform === 'win32' ? 'where.exe' : 'which';
      const raw = execFileSync(probe, [command], { encoding: 'utf8', windowsHide: true, timeout: 3000 }).trim();
      const first = raw.split(/\r?\n/).find(Boolean);
      if (first) found.push({ command, path: first });
    } catch {}
  }
  return found;
}

function discoverEnvironment() {
  return {
    schema: 'dt-environment-discovery/1.0',
    host: os.hostname(), platform: process.platform, arch: process.arch,
    home: os.homedir(), googleDrive: discoverGoogleDrive(),
    executables: discoverExecutables(), discoveredAt: new Date().toISOString()
  };
}

module.exports = { discoverEnvironment, discoverGoogleDrive, discoverExecutables };
