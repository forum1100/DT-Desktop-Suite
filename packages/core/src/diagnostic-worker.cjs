const { parentPort } = require('node:worker_threads');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function classify(text = '') {
  const value = String(text);
  const hits = [];
  if (/SyntaxError|ParserError|unexpected token|unmatched/i.test(value)) hits.push('SYNTAX');
  if (/module not found|cannot find module|not recognized/i.test(value)) hits.push('MISSING_DEPENDENCY');
  if (/no such file|cannot find path|file not found|ENOENT/i.test(value)) hits.push('PATH_OR_FILE');
  if (/being used by another process|file lock|locked/i.test(value)) hits.push('FILE_LOCK');
  if (/ECONN|ENET|HTTP\s+[45]\d\d|timed out|timeout/i.test(value)) hits.push('NETWORK');
  if (/AssertionError|tests? failed|expected .* actual/i.test(value)) hits.push('TEST_FAILURE');
  return hits.length ? hits : ['UNCLASSIFIED'];
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function analyzeIncident(payload = {}) {
  const combined = [payload.error, payload.stderr, payload.stdout, payload.context]
    .filter(Boolean).join('\n');
  const classes = classify(combined);
  const tests = [];
  if (classes.includes('SYNTAX')) tests.push('Run the language syntax checker against the changed file before rerunning the stack.');
  if (classes.includes('MISSING_DEPENDENCY')) tests.push('Verify executable/module resolution and installed dependency state.');
  if (classes.includes('PATH_OR_FILE')) tests.push('Verify the resolved absolute path and existence before execution.');
  if (classes.includes('FILE_LOCK')) tests.push('Identify the owning process and retry through an atomic replace path.');
  if (classes.includes('NETWORK')) tests.push('Run a bounded connectivity/status probe and preserve HTTP/socket evidence.');
  if (classes.includes('TEST_FAILURE')) tests.push('Isolate the failing test and compare it with the last passing checkpoint.');
  if (!tests.length) tests.push('Preserve the failure, compare against the last passing checkpoint, and reduce to the smallest reproducible case.');
  return {
    kind: 'INCIDENT_DIAGNOSIS', classes, tests,
    incidentHash: hash({ combined, classes }),
    generatedAt: new Date().toISOString()
  };
}
function distillExperience(payload = {}) {
  const events = Array.isArray(payload.events) ? payload.events : [];
  const commands = events.filter(event => event?.kind === 'terminal-command' || event?.kind === 'headless-command');
  const successes = commands.filter(event => event?.data?.exitCode === 0 || event?.data?.success === true);
  const failures = commands.filter(event => event?.data?.exitCode > 0 || event?.data?.success === false);
  return {
    kind: 'EXPERIENCE_DISTILLATION', eventCount: events.length,
    successfulCommandCount: successes.length, failedCommandCount: failures.length,
    successfulPatterns: successes.slice(-50).map(event => ({
      command: event.data?.command || null,
      cwd: event.data?.cwd || null,
      resultHash: event.hash || null
    })),
    preservedFailureHashes: failures.slice(-50).map(event => event.hash).filter(Boolean),
    generatedAt: new Date().toISOString()
  };
}

function convergeMemory(payload = {}) {
  const records = Array.isArray(payload.records) ? payload.records : [];
  const unique = new Map();
  for (const record of records) unique.set(record?.hash || hash(record), record);
  return {
    kind: 'MEMORY_CONVERGENCE', inputCount: records.length,
    uniqueCount: unique.size, recordHashes: [...unique.keys()],
    convergenceHash: hash([...unique.keys()].sort()),
    generatedAt: new Date().toISOString()
  };
}

function handleJob(job = {}) {
  if (job.type === 'incident.diagnose') return analyzeIncident(job.payload || {});
  if (job.type === 'experience.distill') return distillExperience(job.payload || {});
  if (job.type === 'memory.converge') return convergeMemory(job.payload || {});
  if (job.type === 'corpus.inventory') return inventoryCorpus(job.payload || {});
  throw new Error('Unsupported diagnostic worker job: ' + job.type);
}

if (parentPort) {
  parentPort.on('message', job => {
    try { parentPort.postMessage({ jobId: job.jobId, ok: true, result: handleJob(job) }); }
    catch (error) { parentPort.postMessage({ jobId: job.jobId, ok: false, error: String(error.message || error) }); }
  });
}

module.exports = { classify, analyzeIncident, distillExperience, convergeMemory, inventoryCorpus, handleJob };

function inventoryCorpus(payload = {}) {
  const roots = (payload.roots || []).map(value => path.resolve(String(value))).filter(value => fs.existsSync(value));
  const outputFile = payload.outputFile ? path.resolve(String(payload.outputFile)) : null;
  const chatPattern = /chatgpt|grok|conversation|export|closeout|transcript|memory/i;
  let files = 0, bytes = 0, chatCandidates = 0, errors = 0;
  const rows = [];
  const stack = roots.slice();
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch { errors++; continue; }
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) { stack.push(target); continue; }
      if (!entry.isFile()) continue;
      try {
        const stat = fs.statSync(target);
        files++; bytes += stat.size;
        const row = { path: target, bytes: stat.size, modifiedMs: stat.mtimeMs,
          extension: path.extname(entry.name).toLowerCase(), chatCandidate: chatPattern.test(target) };
        if (row.chatCandidate) chatCandidates++;
        rows.push(row);
      } catch { errors++; }
    }
  }
  if (outputFile) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    const temp = outputFile + '.tmp';
    fs.writeFileSync(temp, rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), 'utf8');
    fs.renameSync(temp, outputFile);
  }
  return {
    kind: 'CORPUS_INVENTORY', roots, files, bytes, chatCandidates, errors,
    outputFile, manifestHash: hash(rows.map(row => [row.path, row.bytes, row.modifiedMs])),
    generatedAt: new Date().toISOString()
  };
}
