const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const sessions = new Map();
let mainWindow;

function auditFile() {
  const root = path.join(app.getPath('userData'), 'command-center');
  fs.mkdirSync(root, { recursive: true });
  return path.join(root, 'events.jsonl');
}

function redact(value) {
  return String(value)
    .replace(/(sk-[A-Za-z0-9_-]{12,})/g, '[REDACTED_API_KEY]')
    .replace(/(dtk_[A-Za-z0-9_.-]+)/g, '[REDACTED_DT_KEY]')
    .replace(/(dtr_[A-Za-z0-9_.-]+)/g, '[REDACTED_RECOVERY]');
}

function audit(kind, data) {
  const entry = { id: crypto.randomUUID(), kind, at: new Date().toISOString(), data };
  fs.appendFileSync(auditFile(), JSON.stringify(entry) + '\n');
  return entry;
}

function publicSession(session) {
  return { id: session.id, name: session.name, owner: session.owner, cwd: session.cwd, pid: session.child.pid, state: session.state, createdAt: session.createdAt };
}

function createSession({ name, owner, cwd }) {
  if (!name || !owner || !cwd) throw new Error('Name, owner, and working directory are required');
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Working directory does not exist');
  const id = crypto.randomUUID();
  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NoExit', '-Command', '-'], {
    cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
  });
  const session = { id, name, owner, cwd, child, state: 'running', createdAt: new Date().toISOString() };
  sessions.set(id, session);
  const emit = (stream, chunk) => mainWindow?.webContents.send('terminal:output', { id, stream, text: chunk.toString() });
  child.stdout.on('data', chunk => emit('stdout', chunk));
  child.stderr.on('data', chunk => emit('stderr', chunk));
  child.on('exit', code => {
    session.state = 'exited';
    audit('session-exit', { id, code });
    mainWindow?.webContents.send('terminal:state', publicSession(session));
  });
  audit('session-create', publicSession(session));
  return publicSession(session);
}

function sendCommand(id, command) {
  const session = sessions.get(id);
  if (!session || session.state !== 'running') throw new Error('Session is not running');
  const commandId = crypto.randomUUID();
  const safe = redact(command);
  audit('command', { sessionId: id, commandId, text: safe, originalHash: crypto.createHash('sha256').update(command).digest('hex') });
  session.child.stdin.write(command + `; Write-Output "__DT_DONE__:${commandId}:$LASTEXITCODE"` + '\n');
  return { commandId };
}

function closeSession(id) {
  const session = sessions.get(id);
  if (!session || session.state !== 'running') return false;
  session.child.stdin.write('exit\n');
  session.state = 'closing';
  audit('session-close-request', { id });
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380, height: 880, minWidth: 940, minHeight: 620,
    backgroundColor: '#050611',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('sessions:list', () => [...sessions.values()].map(publicSession));
  ipcMain.handle('sessions:create', (_event, input) => createSession(input));
  ipcMain.handle('sessions:send', (_event, id, command) => sendCommand(id, command));
  ipcMain.handle('sessions:close', (_event, id) => closeSession(id));
  createWindow();
});

app.on('before-quit', () => {
  for (const session of sessions.values()) if (session.state === 'running') session.child.stdin.write('exit\n');
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
