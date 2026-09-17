const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Worker } = require('node:worker_threads');

class ResidentRuntime {
  constructor({ root, vault = null, experience = null, maxWorkers = 3 }) {
    this.root = path.join(root, 'resident-runtime');
    this.queueFile = path.join(this.root, 'jobs.jsonl');
    this.stateFile = path.join(this.root, 'state.json');
    this.vault = vault;
    this.experience = experience;
    this.maxWorkers = Math.max(1, Number(maxWorkers) || 3);
    this.queue = [];
    this.active = new Map();
    this.timer = null;
    fs.mkdirSync(this.root, { recursive: true });
  }

  append(job) {
    fs.appendFileSync(this.queueFile, JSON.stringify(job) + '\n', 'utf8');
  }

  submit(type, payload = {}, priority = 100) {
    const job = { jobId: crypto.randomUUID(), type, payload, priority,
      status: 'PENDING', createdAt: new Date().toISOString() };
    this.queue.push(job); this.append(job);
    this.vault?.append('resident-job-submitted', 'dt-runtime', { jobId: job.jobId, type, priority });
    return job;
  }
  submitIncident(payload = {}) {
    return this.submit('incident.diagnose', payload, 10);
  }

  submitExperience(events = []) {
    return this.submit('experience.distill', { events }, 50);
  }

  submitMemory(records = []) {
    return this.submit('memory.converge', { records }, 60);
  }

  launch(job) {
    const worker = new Worker(path.join(__dirname, 'diagnostic-worker.cjs'));
    job.status = 'RUNNING'; job.startedAt = new Date().toISOString();
    this.active.set(job.jobId, { job, worker });
    this.append({ ...job, event: 'STARTED' });
    worker.on('message', message => this.finish(job, worker, message));
    worker.on('error', error => this.finish(job, worker, { ok: false, error: String(error.message || error) }));
    worker.postMessage(job);
  }

  finish(job, worker, message) {
    if (!this.active.has(job.jobId)) return;
    this.active.delete(job.jobId);
    try { worker.terminate(); } catch {}
    job.status = message.ok ? 'DONE' : 'FAILED';
    job.completedAt = new Date().toISOString();
    job.result = message.result || null; job.error = message.error || null;
    this.append({ ...job, event: job.status });
    this.vault?.append('resident-job-' + job.status.toLowerCase(), 'dt-runtime', {
      jobId: job.jobId, type: job.type, result: job.result, error: job.error
    });
    this.writeState();
  }
  tick() {
    if (this.active.size >= this.maxWorkers) return;
    this.queue.sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
    while (this.active.size < this.maxWorkers) {
      const next = this.queue.find(job => job.status === 'PENDING');
      if (!next) break;
      this.launch(next);
    }
    this.writeState();
  }

  writeState() {
    const state = {
      schema: 'dt-resident-runtime/1.0',
      running: Boolean(this.timer),
      maxWorkers: this.maxWorkers,
      active: [...this.active.values()].map(item => ({
        jobId: item.job.jobId, type: item.job.type, startedAt: item.job.startedAt
      })),
      pending: this.queue.filter(job => job.status === 'PENDING').map(job => ({
        jobId: job.jobId, type: job.type, priority: job.priority, createdAt: job.createdAt
      })),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
    return state;
  }

  status() { return this.writeState(); }

  start() {
    if (!this.timer) this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
    return this.status();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const { worker } of this.active.values()) { try { worker.terminate(); } catch {} }
    this.active.clear();
    return this.status();
  }
}

module.exports = { ResidentRuntime };
