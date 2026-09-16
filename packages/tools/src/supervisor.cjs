const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');

const DEFAULT_PERSISTENT_AGENTS = Object.freeze([
  'agent-supervisor', 'agent-foundry', 'operations-historian',
  'librarian', 'dt-closeout', 'source-discovery', 'ingestion-spark'
]);

class EmbeddedSupervisor {
  constructor({ app, vault, agents, intervalMs = 10000 }) {
    this.app = app;
    this.vault = vault;
    this.agents = agents;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.leader = false;
    this.lastStates = new Map();
    this.lastRestartAt = new Map();
  }

  runtimeRoot() {
    const root = path.join(process.env.USERPROFILE || this.app.getPath('home'), 'TJ_Personal_Pro', 'data', 'runtime');
    fs.mkdirSync(root, { recursive: true });
    return root;
  }
  trainingRoot() {
    const root = path.join(process.env.USERPROFILE || this.app.getPath('home'), 'Documents', 'TJ_Command_Bridge', 'training', 'observations');
    fs.mkdirSync(root, { recursive: true });
    return root;
  }

  lockPath() {
    return path.join(this.runtimeRoot(), 'embedded_supervisor.lock.json');
  }

  pidAlive(pid) {
    try { process.kill(Number(pid), 0); return true; }
    catch { return false; }
  }

  writeObservation(kind, payload = {}) {
    const row = {
      schema: 'dt-training-observation/1.0',
      lesson_type: kind,
      observed_at: new Date().toISOString(),
      provenance: 'DT Desktop Suite embedded supervisor',
      sensitive_payloads_duplicated: false,
      ...payload
    };
    const stamp = row.observed_at.replace(/[:.]/g, '-');
    const file = path.join(this.trainingRoot(), `${stamp}-${crypto.randomUUID()}-${kind}.json`);
    fs.writeFileSync(file, JSON.stringify(row, null, 2), 'utf8');
    return file;
  }
  tryBecomeLeader() {
    if (this.leader) return true;
    const lock = this.lockPath();
    try {
      if (fs.existsSync(lock)) {
        const prior = JSON.parse(fs.readFileSync(lock, 'utf8'));
        if (prior.pid && this.pidAlive(prior.pid)) return false;
        fs.unlinkSync(lock);
      }
      const fd = fs.openSync(lock, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }, null, 2));
      fs.closeSync(fd);
      this.leader = true;
      this.writeObservation('supervisor-leadership', { pid: process.pid, status: 'leader-acquired' });
      return true;
    } catch { return false; }
  }

  inventory() {
    const ps = "$names=@('DT Desktop Suite.exe','electron.exe'); Get-CimInstance Win32_Process | Where-Object {$names -contains $_.Name} | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress";
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 1024 * 1024
    }).trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  launchAgent(agentId) {
    const executable = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    const args = [];
    if (!this.app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE) args.push(this.app.getAppPath());
    args.push(`--agent=${agentId}`);
    const child = spawn(executable, args, {
      detached: true, stdio: 'ignore', windowsHide: false,
      cwd: path.dirname(executable)
    });
    child.unref();
    this.lastRestartAt.set(agentId, Date.now());
    return child.pid;
  }

  tick() {
    if (!this.tryBecomeLeader()) return;
    let rows = [];
    let error = null;
    try { rows = this.inventory(); }
    catch (err) { error = err.message; }
    const commands = rows.map(row => String(row.CommandLine || ''));
    const states = {};
    for (const agentId of DEFAULT_PERSISTENT_AGENTS) {
      const running = commands.some(command => command.includes(`--agent=${agentId}`));
      states[agentId] = running;
      const previous = this.lastStates.get(agentId);
      if (previous !== running) {
        this.writeObservation('agent-supervision', { agent: agentId, running, status: running ? 'observed-running' : 'missing' });
        this.lastStates.set(agentId, running);
      }
      if (!running) {
        const last = this.lastRestartAt.get(agentId) || 0;
        if (Date.now() - last >= 30000) {
          const pid = this.launchAgent(agentId);
          this.writeObservation('agent-supervision', { agent: agentId, running: false, status: 'restart-requested', pid });
        }
      }
    }
    const status = {
      observed_at: new Date().toISOString(),
      supervisor: 'ready',
      leader_pid: process.pid,
      agents: states,
      inventory_count: rows.length,
      error,
      training: 'append-only vault-referenced observations',
      local_only: true
    };
    fs.writeFileSync(path.join(this.runtimeRoot(), 'embedded_supervisor_status.json'), JSON.stringify(status, null, 2), 'utf8');
  }

  recordAgentRun(agentId, receipt, runtimeMetric, success, error = null) {
    return this.writeObservation('agent-execution', {
      agent: agentId,
      status: success ? 'executed' : 'failed',
      runtimeMetric,
      error,
      vault_receipt: receipt ? { id: receipt.id, hash: receipt.hash, kind: receipt.kind, createdAt: receipt.createdAt } : null,
      payload_mode: 'canonical-vault-reference'
    });
  }
  recordWorkflow(kind, result) {
    return this.writeObservation('workflow-execution', {
      workflow_kind: kind,
      status: 'recorded',
      checkpoint_id: result?.checkpoint?.id || result?.completion?.id || null,
      failures: Array.isArray(result?.failures) ? result.failures.length : null,
      payload_mode: 'canonical-vault-reference'
    });
  }

  start() {
    this.tryBecomeLeader();
    this.tick();
    if (!this.timer) this.timer = setInterval(() => this.tick(), this.intervalMs);
    return { leader: this.leader, pid: process.pid };
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (!this.leader) return;
    const lock = this.lockPath();
    try {
      const row = JSON.parse(fs.readFileSync(lock, 'utf8'));
      if (Number(row.pid) === process.pid) fs.unlinkSync(lock);
    } catch {}
    this.leader = false;
  }
}

module.exports = { EmbeddedSupervisor, DEFAULT_PERSISTENT_AGENTS };
