const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPLAY_ROOT = path.resolve(__dirname, '..', 'replay');
const REGISTRY_PATH = path.join(REPLAY_ROOT, 'registry.json');

function readRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function listSimulations() {
  return readRegistry().simulations.map(item => ({
    simulationId: item.simulation_id,
    family: item.family,
    status: item.status,
    sourceClass: item.source_class,
    runnable: Boolean(item.entrypoint)
  }));
}

function resolveRegisteredSimulation(simulationId) {
  const item = readRegistry().simulations.find(x => x.simulation_id === simulationId);
  if (!item) throw new Error(`Unknown simulation: ${simulationId}`);
  if (!item.entrypoint) throw new Error(`Simulation is not runnable: ${item.status}`);
  const entrypoint = path.resolve(REPLAY_ROOT, item.entrypoint);
  const relative = path.relative(REPLAY_ROOT, entrypoint);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Registered simulation escaped replay root');
  }
  if (!fs.existsSync(entrypoint)) throw new Error('Registered entrypoint is missing');
  return { item, entrypoint };
}

function replaySimulation({ simulationId, pythonPath, outputRoot, extraArgs = [] }) {
  if (!pythonPath || !fs.existsSync(pythonPath)) throw new Error('Explicit Python runtime is required');
  if (!Array.isArray(extraArgs) || extraArgs.some(x => typeof x !== 'string')) {
    throw new Error('extraArgs must be an array of strings');
  }
  const { item, entrypoint } = resolveRegisteredSimulation(simulationId);
  const runRoot = path.resolve(outputRoot || path.join(REPLAY_ROOT, 'runs'));
  fs.mkdirSync(runRoot, { recursive: true });
  const runId = new Date().toISOString().replace(/[:]/g, '-');
  const outDir = path.join(runRoot, simulationId, runId, 'outputs');
  fs.mkdirSync(outDir, { recursive: true });
  const args = [entrypoint, '--out-dir', outDir, ...(item.default_args || []), ...extraArgs];
  const startedAt = new Date().toISOString();
  const result = spawnSync(pythonPath, args, {
    cwd: REPLAY_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024
  });
  const finishedAt = new Date().toISOString();
  const runDir = path.dirname(outDir);
  fs.writeFileSync(path.join(runDir, 'stdout.txt'), result.stdout || '', 'utf8');
  fs.writeFileSync(path.join(runDir, 'stderr.txt'), result.stderr || '', 'utf8');
  const receipt = {
    simulationId,
    sourceClass: item.source_class,
    registryStatusAtRun: item.status,
    startedAt,
    finishedAt,
    exitCode: result.status,
    executionStatus: result.status === 0 ? 'EXECUTED_SUCCESS' : 'EXECUTED_FAILURE',
    pythonPath,
    args,
    outputDir: outDir
  };
  fs.writeFileSync(path.join(runDir, 'receipt.json'), JSON.stringify(receipt, null, 2), 'utf8');
  return receipt;
}

module.exports = {
  REPLAY_ROOT,
  REGISTRY_PATH,
  readRegistry,
  listSimulations,
  resolveRegisteredSimulation,
  replaySimulation
};
