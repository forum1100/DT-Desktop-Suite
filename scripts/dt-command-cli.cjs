#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ExperienceLedger } = require('../packages/core/src/experience-ledger.cjs');
const { runHeadlessCommand } = require('../packages/core/src/headless-command.cjs');
const { classifyCommandCenterInput } = require('../packages/core/src/command-center-router.cjs');
const { DTBootstrap } = require('../packages/core/src/bootstrap.cjs');
const { ObservationLearningIndex } = require('../packages/core/src/observation-learning.cjs');

function arg(name, fallback=null){
  const i=process.argv.indexOf(name); return i>=0 && process.argv[i+1] ? process.argv[i+1] : fallback;
}
const ownerApproved=process.argv.includes('--owner-approved');
const raw=arg('--command') || process.argv.slice(2).filter((v,i,a)=>!['--owner-approved','--cwd','--command'].includes(v)&&a[i-1]!=='--cwd'&&a[i-1]!=='--command').join(' ');
if(!raw){ console.error('Usage: node scripts/dt-command-cli.cjs --command "/shell <command>" [--cwd <path>] [--owner-approved]'); process.exit(2); }

const userData=path.join(process.env.APPDATA || path.join(process.env.USERPROFILE||'', 'AppData','Roaming'),'dt-desktop-suite');
const root=path.join(userData,'dt-vault');
const experience=new ExperienceLedger(root);
const bootstrap=new DTBootstrap(root).run();
const decision=classifyCommandCenterInput(raw);
if(decision.route!=='SHELL'){
  experience.append('command-center-input',{text:raw,route:decision.route,reason:decision.reason},{surface:'dt-command-cli'});
  console.error('DT CLI currently accepts shell-routed commands only. Prefix with /shell, $ , or run.');
  process.exit(3);
}

const cwd=path.resolve(arg('--cwd', process.env.USERPROFILE || process.cwd()));
const allowedRoots=[bootstrap.environment?.home, ...(bootstrap.environment?.googleDrive||[]).map(x=>x.root), 'C:\\DT']
  .filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
const commandId=crypto.randomUUID();
experience.append('command-center-input',{
  text:raw,route:'SHELL',reason:decision.reason,commandId,cwd,deviceId:bootstrap.identity.deviceId
},{surface:'dt-command-cli',deviceId:bootstrap.identity.deviceId});

let result;
try{
  result=runHeadlessCommand({command:decision.payload,cwd,timeoutSeconds:120},{},{ownerApproved,defaultCwd:cwd,allowedRoots});
}catch(error){
  experience.append('headless-command-failure',{commandId,command:decision.payload,cwd,error:String(error.stack||error)},
    {surface:'dt-command-cli',deviceId:bootstrap.identity.deviceId});
  console.error(error.message || String(error)); process.exit(4);
}
experience.append('headless-command',{
  commandId,command:result.command,cwd:result.cwd,exitCode:result.exitCode,
  stdout:result.stdout,stderr:result.stderr,error:result.error,success:result.exitCode===0,
  risk:result.risk,deviceId:bootstrap.identity.deviceId
},{surface:'dt-command-cli',deviceId:bootstrap.identity.deviceId});

const observationRoot=path.join(process.env.USERPROFILE||'', 'Documents','TJ_Command_Bridge','training','observations');
fs.mkdirSync(observationRoot,{recursive:true});
const observation={
  observed_at:new Date().toISOString(), lesson_type:'command_execution', agent:'dt-command-cli',
  status:result.exitCode===0?'OBSERVED_SUCCESS':'OBSERVED_FAILURE', workflow_kind:'DEVICE_COMMAND_LINE',
  command:result.command,cwd:result.cwd,exit_code:result.exitCode,
  stdout_tail:String(result.stdout||'').slice(-2000),stderr_tail:String(result.stderr||'').slice(-2000),
  device_id:bootstrap.identity.deviceId,
  provenance:{surface:'dt-command-cli',command_id:commandId,reason:decision.reason},
  authority_effect:'NONE', executable_promotion:false
};
const observationFile=path.join(observationRoot,`${new Date().toISOString().replace(/[:.]/g,'-')}__${commandId}.json`);
fs.writeFileSync(observationFile,JSON.stringify(observation,null,2),'utf8');
const learning=new ObservationLearningIndex({root,observationRoot});
const learned=learning.ingest();
console.log(JSON.stringify({commandId,deviceId:bootstrap.identity.deviceId,route:'SHELL',result,observationFile,learning:learned},null,2));
process.exit(result.exitCode===0?0:result.exitCode||1);
