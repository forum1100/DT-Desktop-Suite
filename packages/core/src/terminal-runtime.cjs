const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

class TerminalRuntime {
  constructor({ auditRoot, emit = () => {}, vault = null, experience = null, residentRuntime = null }) {
    this.auditRoot = auditRoot;
    this.emit = emit;
    this.vault = vault;
    this.experience = experience;
    this.residentRuntime = residentRuntime;
    this.sessions = new Map();
    fs.mkdirSync(this.auditRoot, { recursive: true });
  }

  auditFile() { return path.join(this.auditRoot, 'events.jsonl'); }

  redact(value) {
    return String(value)
      .replace(/(sk-[A-Za-z0-9_-]{12,})/g, '[REDACTED_API_KEY]')
      .replace(/(dtk_[A-Za-z0-9_.-]+)/g, '[REDACTED_DT_KEY]')
      .replace(/(dtr_[A-Za-z0-9_.-]+)/g, '[REDACTED_RECOVERY]');
  }

  audit(kind, data) {
    const entry = { id: crypto.randomUUID(), kind, at: new Date().toISOString(), data };
    fs.appendFileSync(this.auditFile(), JSON.stringify(entry) + '\n');
    this.vault?.append('terminal-' + kind, 'dt-shell', data);
    return entry;
  }

  publicSession(session) {
    return { id: session.id, name: session.name, owner: session.owner, cwd: session.cwd,
      pid: session.child.pid, state: session.state, createdAt: session.createdAt };
  }
  create({ name, owner, cwd }) {
    if (!name || !owner || !cwd) throw new Error('Name, owner, and working directory are required');
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Working directory does not exist');
    const id = crypto.randomUUID();
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NoExit'], {
      cwd,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const session = { id, name, owner, cwd, child, state: 'running', createdAt: new Date().toISOString(), activeCommand: null };
    this.sessions.set(id, session);
    const emit = (stream, chunk) => this.handleOutput(session, stream, chunk);
    child.stdout.on('data', chunk => emit('stdout', chunk));
    child.stderr.on('data', chunk => emit('stderr', chunk));
    child.on('exit', code => {
      session.state = 'exited';
      this.audit('session-exit', { id, code });
      this.emit('terminal:state', this.publicSession(session));
    });
    this.audit('session-create', this.publicSession(session));
    return this.publicSession(session);
  }

  handleOutput(session, stream, chunk) {
    const text = chunk.toString();
    this.emit('terminal:output', { id: session.id, stream, text });
    if (!session.activeCommand) return;
    if (stream === 'stderr') session.activeCommand.stderr += text;
    else session.activeCommand.stdout += text;
    const marker = new RegExp('__DT_DONE__:' + session.activeCommand.commandId + ':(-?\\d+)');
    const match = marker.exec(session.activeCommand.stdout);
    if (!match) return;
    const completed = session.activeCommand;
    session.activeCommand = null;
    completed.exitCode = Number(match[1]);
    completed.stdout = completed.stdout.replace(marker, '').trim();
    completed.stderr = completed.stderr.trim();
    completed.completedAt = new Date().toISOString();
    completed.success = completed.exitCode === 0;
    this.experience?.append('terminal-command', completed, { surface: 'dt-shell' });
    if (!completed.success) this.residentRuntime?.submitIncident({
      source: 'terminal-command', command: completed.command, cwd: completed.cwd,
      exitCode: completed.exitCode, stdout: completed.stdout, stderr: completed.stderr
    });
  }

  send(id, command) {
    const session = this.sessions.get(id);
    if (!session || session.state !== 'running') throw new Error('Session is not running');
    if (session.activeCommand) throw new Error('Previous command is still running in this DT shell');
    const commandId = crypto.randomUUID();
    this.audit('command', { sessionId: id, commandId, text: this.redact(command),
      originalHash: crypto.createHash('sha256').update(command).digest('hex') });
    session.activeCommand = {
      sessionId: id, commandId, command: String(command), cwd: session.cwd,
      submittedAt: new Date().toISOString(), stdout: '', stderr: ''
    };
    this.experience?.append('terminal-command-submitted', {
      sessionId: id, commandId, command: String(command), cwd: session.cwd
    }, { surface: 'dt-shell' });
    session.child.stdin.write(command + `; Write-Output "__DT_DONE__:${commandId}:$LASTEXITCODE"` + '\n');
    return { commandId };
  }
  close(id) {
    const session = this.sessions.get(id);
    if (!session || session.state !== 'running') return false;
    session.child.stdin.write('exit\n');
    session.state = 'closing';
    this.audit('session-close-request', { id });
    this.emit('terminal:state', this.publicSession(session));
    return true;
  }

  list() {
    return [...this.sessions.values()].map(session => this.publicSession(session));
  }

  closeAll() {
    for (const session of this.sessions.values()) {
      if (session.state === 'running') {
        try { session.child.stdin.write('exit\n'); } catch {}
        session.state = 'closing';
      }
    }
  }
}

module.exports = { TerminalRuntime };
