const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  const temp = file + '.tmp-' + process.pid + '-' + crypto.randomUUID();
  const fd = fs.openSync(temp, 'w');
  try {
    fs.writeFileSync(fd, JSON.stringify(value, null, 2), 'utf8');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
  return value;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

class CampaignDurability {
  constructor(root, options={}) {
    this.root = path.join(root, 'orion-campaign');
    this.stateFile = path.join(this.root, 'state.json');
    this.journalFile = path.join(this.root, 'journal.jsonl');
    this.bootstrapEnd = options.bootstrapEnd || '2026-10-22T22:29:00-04:00';
    this.campaignEnd = options.campaignEnd || '2026-11-26T23:40:00-05:00';
    fs.mkdirSync(this.root, { recursive:true });
  }
  phase(now=Date.now()) {
    if (now >= new Date(this.campaignEnd).getTime()) return 'COMPLETE';
    if (now < new Date(this.bootstrapEnd).getTime()) return 'BOOTSTRAP_TRAINING';
    return 'APPLICATION_IMPROVEMENT';
  }

  load() {
    return readJson(this.stateFile, {
      schema:'orion-campaign-state/1.0',
      phase:this.phase(),
      runId:crypto.randomUUID(),
      checkpoints:{},
      ingestion:{roots:{},processedHashes:{}},
      browserSessions:{},
      ownerAuthorization:{selfDirectedInputs:true},
      updatedAt:new Date().toISOString()
    });
  }

  save(state) {
    state.phase = this.phase();
    state.updatedAt = new Date().toISOString();
    return atomicJson(this.stateFile, state);
  }
  checkpoint(name, data={}) {
    const state = this.load();
    state.checkpoints[name] = {
      ...data,
      completedAt:new Date().toISOString()
    };
    this.journal('checkpoint', { name, data:state.checkpoints[name] });
    return this.save(state);
  }

  journal(kind, data={}) {
    const row = {
      schema:'orion-campaign-journal/1.0',
      at:new Date().toISOString(),
      kind,
      data
    };
    fs.appendFileSync(this.journalFile, JSON.stringify(row)+'\n', 'utf8');
    return row;
  }

  recordIngestion(sourcePath, fingerprint, metadata={}) {
    const state=this.load();
    state.ingestion.processedHashes[fingerprint]={sourcePath,...metadata,at:new Date().toISOString()};
    this.save(state);
    return state.ingestion.processedHashes[fingerprint];
  }
  hasIngested(fingerprint) {
    return Boolean(this.load().ingestion.processedHashes[fingerprint]);
  }

  recordBrowserSession(provider, observation={}) {
    const state=this.load();
    const prior=state.browserSessions[provider] || { observations:[] };
    prior.observations.push({ at:new Date().toISOString(), ...observation });
    prior.last=prior.observations[prior.observations.length-1];
    state.browserSessions[provider]=prior;
    this.save(state);
    this.journal('browser-session', { provider, observation:prior.last });
    return prior.last;
  }

  recoveryPlan() {
    const state=this.load();
    return {
      runId:state.runId,
      phase:this.phase(),
      completed:Object.keys(state.checkpoints),
      ingestionCount:Object.keys(state.ingestion.processedHashes||{}).length,
      browserProviders:Object.keys(state.browserSessions||{}),
      resumeFromCrash:true,
      selfDirectedInputs:state.ownerAuthorization?.selfDirectedInputs===true
    };
  }
}

module.exports={ CampaignDurability, atomicJson, readJson };
