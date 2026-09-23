const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { sampleHardware, evaluateHardware } = require('./hardware-governor.cjs');
const { mineHistory, writeHistoryIndex } = require('./history-method-miner.cjs');
const { CampaignDurability } = require('./campaign-durability.cjs');

function safeJson(text) {
  const source=String(text||'').trim();
  try{return JSON.parse(source);}catch{}
  const a=source.indexOf('{'), b=source.lastIndexOf('}');
  if(a>=0&&b>a)return JSON.parse(source.slice(a,b+1));
  throw new Error('Orion response was not valid JSON');
}

class OrionImprovementLoop {
  constructor({ root, repoRoot, localIntelligence, runAICouncil, vault=null, experience=null,
    intervalMs=1800000, historyRoots=[], campaignEnd=null, autoPromote=true }) {
    this.root=path.join(root,'orion-improvement');
    this.repoRoot=path.resolve(repoRoot); this.local=localIntelligence; this.runAICouncil=runAICouncil;
    this.vault=vault; this.experience=experience;
    this.intervalMs=Math.max(300000,Number(intervalMs)||1800000);
    this.historyRoots=[...new Set(historyRoots.map(x=>path.resolve(String(x))).filter(x=>fs.existsSync(x)))];
    this.campaignEnd=campaignEnd?new Date(campaignEnd):new Date(2026,10,26,23,40,0,0);
    this.autoPromote=autoPromote===true; this.timer=null; this.hardwareTimer=null; this.historyTimer=null;
    this.running=false; this.lastHardware=null; this.hardwareState=null; this.historyIndex=null; this.cycleCount=0;
    fs.mkdirSync(this.root,{recursive:true});
    this.durability=new CampaignDurability(root, {
      bootstrapEnd:'2026-10-22T22:29:00-04:00',
      campaignEnd:'2026-11-26T23:40:00-05:00'
    });
    this.durability.journal('campaign-runtime-created', { repoRoot:this.repoRoot, historyRoots:this.historyRoots });
  }
  statusFile(){return path.join(this.root,'status.json');}
  backlogFile(){return path.join(this.root,'backlog.jsonl');}
  append(file,row){fs.appendFileSync(file,JSON.stringify(row)+'\n','utf8');}
  campaignActive(){return Date.now()<this.campaignEnd.getTime();}
  writeStatus(extra={}){
    const state={schema:'orion-improvement/2.0',enabled:Boolean(this.timer),running:this.running,
      campaignEndLocal:this.campaignEnd.toString(),campaignActive:this.campaignActive(),autoPromote:this.autoPromote,
      intervalMs:this.intervalMs,cycleCount:this.cycleCount,hardware:this.hardwareState,
      history:{roots:this.historyRoots,indexedMethods:this.historyIndex?.methods?.length||0,indexedIdeas:this.historyIndex?.ideas?.length||0},
      recovery:this.durability?.recoveryPlan?.() || null,
      updatedAt:new Date().toISOString(),...extra};
    fs.writeFileSync(this.statusFile(),JSON.stringify(state,null,2),'utf8'); return state;
  }
  refreshHardware(){
    this.lastHardware=sampleHardware(); this.hardwareState=evaluateHardware(this.lastHardware);
    this.append(path.join(this.root,'hardware.jsonl'),{sample:this.lastHardware,evaluation:this.hardwareState});
    if(this.hardwareState.severity!=='OK') this.vault?.append('orion-hardware-throttle','orion',this.hardwareState);
    this.writeStatus(); return this.hardwareState;
  }
  refreshHistory(){
    if(!this.historyRoots.length)return null;
    let previousIndex=this.historyIndex;
    if(!previousIndex){
      try{previousIndex=JSON.parse(fs.readFileSync(path.join(this.root,'history-method-index.json'),'utf8'));}catch{}
    }
    this.historyIndex=mineHistory(this.historyRoots,{maxFiles:16000,previousIndex});
    const file=writeHistoryIndex(this.root,this.historyIndex);
    this.vault?.append('orion-history-index','orion',{file,methods:this.historyIndex.methods.length,ideas:this.historyIndex.ideas.length});
    this.durability.checkpoint('history-index', { file, filesScanned:this.historyIndex.filesScanned,
      methods:this.historyIndex.methods.length, ideas:this.historyIndex.ideas.length });
    return this.historyIndex;
  }
  dtLogicSnapshot(){
    const file=path.join(this.repoRoot,'packages','tools','src','briefs.cjs');
    let text=''; try{text=fs.readFileSync(file,'utf8');}catch{}
    const equations=[]; const re=/equation:\s*['"`]([^'"`]{1,500})['"`]/g;
    for(const m of text.matchAll(re)) equations.push(m[1]);
    return {
      provenance:'DT_INTERNAL_HEURISTICS_AND_HISTORICAL_THEORY_NOT_EXTERNAL_SCIENTIFIC_AUTHORITY',
      invariants:[
        'preserve failed branches and residuals',
        'separate prediction, execution, validation, and promotion',
        'information transfer does not transfer authority',
        'prefer convergence that reduces duplicated work without deleting provenance',
        'effective yield must account for retry and coordination cost'
      ],
      equations:equations.slice(0,80)
    };
  }
  frontierContext(track){
    const methods=(this.historyIndex?.methods||[]).slice(-40).map(x=>({term:x.term,source:x.source,excerpt:x.excerpt}));
    const ideas=(this.historyIndex?.ideas||[]).sort((a,b)=>b.modifiedMs-a.modifiedMs).slice(0,60)
      .map(x=>({source:x.source,excerpt:x.excerpt}));
    return {track,dtLogic:this.dtLogicSnapshot(),historicalMethods:methods,ideaCandidates:ideas,
      hardware:this.hardwareState,campaignEnds:this.campaignEnd.toString()};
  }
  async discover(track){
    const task=track==='IDEA_REALIZATION'
      ? 'Choose one preserved user app/program/platform idea that can become an interlocking DT component. Favor reuse of existing DT services, agents, memory, perception, browser, hardware, message board, and closeout infrastructure. Return architecture, interfaces, tests, risks, dependencies, and why it should be built now.'
      : 'Identify one missing or materially weak DT/Orion capability that would be a major upgrade. Prefer a capability none of the participating AIs currently provide natively. Return bounded architecture, implementation path, tests, risks, and expected value.';
    return this.runAICouncil({task:task+'\nCONTEXT:'+JSON.stringify(this.frontierContext(track)),advisoryOnly:true},{ownerApproved:false});
  }
  async draftCandidate(track,frontier){
    const system=[
      'You are Orion, the resident DT software engineer.',
      'Create a sandbox-only implementation candidate from the supplied frontier.',
      'Return JSON only with candidateId, summary, language, files, tests, risks, dependencies, interlocks.',
      'files must be an array of {path,content}; paths are repository-relative.',
      'Use whatever programming language best fits the component, but integrate with existing DT interfaces when possible.',
      'Apply DT logic as provenance-labeled engineering heuristics, not as unverified scientific truth.',
      'Do not modify credentials, authorization policy, protected archives, signing configuration, or production binaries.',
      'Prefer small composable changes and regression tests.'
    ].join('\n');
    const raw=await this.local.complete({system,prompt:JSON.stringify({track,frontier,context:this.frontierContext(track)})});
    return safeJson(raw);
  }
  validateCandidate(candidate){
    if(!candidate||!Array.isArray(candidate.files)||!candidate.files.length)throw new Error('Candidate has no files');
    if(candidate.files.length>16)throw new Error('Candidate exceeds file limit');
    const allowedTop=new Set(['apps','packages','tests','docs','resources']);
    return candidate.files.map(file=>{
      const rel=String(file.path||'').replace(/\\/g,'/');
      if(!rel||path.isAbsolute(rel)||rel.includes('../')||rel.startsWith('.git/'))throw new Error('Unsafe candidate path: '+rel);
      if(!allowedTop.has(rel.split('/')[0]))throw new Error('Candidate path outside improvement surface: '+rel);
      if(/package(-lock)?\.json$|credential|secret|\.env|sign|installer|authorization/i.test(rel))throw new Error('Protected candidate path: '+rel);
      const content=String(file.content??'');
      if(Buffer.byteLength(content,'utf8')>512*1024)throw new Error('Candidate file too large: '+rel);
      return {path:rel,content};
    });
  }
  gitExecutable(){
    const candidates=[process.env.DT_GIT_EXE,
      'C:/Program Files/Git/cmd/git.exe','C:/Program Files/Git/bin/git.exe',
      path.join(process.env.LOCALAPPDATA||'','Programs','Git','cmd','git.exe'),'git'].filter(Boolean);
    for(const exe of candidates){
      try{const p=spawnSync(exe,['--version'],{encoding:'utf8',windowsHide:true,timeout:5000});if(p.status===0)return exe;}catch{}
    }
    return null;
  }
  makeWorktree(candidateId){
    const git=this.gitExecutable(); if(!git)throw new Error('Git unavailable: autonomous branch workspace cannot be created');
    const safe=String(candidateId||crypto.randomUUID()).replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,80);
    const worktree=path.join(this.root,'worktrees',safe), branch='orion-improve/'+safe;
    fs.mkdirSync(path.dirname(worktree),{recursive:true});
    const p=spawnSync(git,['worktree','add','-b',branch,worktree,'HEAD'],{cwd:this.repoRoot,encoding:'utf8',windowsHide:true,timeout:60000});
    if(p.status!==0)throw new Error('Could not create Orion worktree: '+String(p.stderr||p.stdout));
    return {git,worktree,branch};
  }
  applyFiles(worktree,files){
    for(const file of files){
      const target=path.resolve(worktree,file.path);
      if(!(target===worktree||target.startsWith(worktree+path.sep)))throw new Error('Worktree path escape');
      fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,file.content,'utf8');
    }
  }
  syntaxCheck(worktree,file){
    const target=path.join(worktree,file.path); let command=null,args=[];
    if(/\.(cjs|mjs|js)$/i.test(file.path)){command='node';args=['--check',target];}
    else if(/\.py$/i.test(file.path)){command='python';args=['-m','py_compile',target];}
    else if(/\.ps1$/i.test(file.path)){command='powershell.exe';args=['-NoProfile','-NonInteractive','-Command',`[scriptblock]::Create((Get-Content -Raw -LiteralPath '${target.replace(/'/g,"''")}'))|Out-Null`];}
    if(!command)return {file:file.path,skipped:true};
    const p=spawnSync(command,args,{cwd:worktree,encoding:'utf8',windowsHide:true,timeout:60000});
    return {file:file.path,command:[command,...args].join(' '),exitCode:p.status,stdout:String(p.stdout||'').slice(-3000),stderr:String(p.stderr||'').slice(-3000)};
  }
  runGuarded(command,args,cwd,timeoutMs=300000){
    return new Promise(resolve=>{
      const child=spawn(command,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});
      let stdout='',stderr='',stoppedBy=null,highPressure=0,done=false;
      const finish=result=>{if(done)return;done=true;clearInterval(monitor);clearTimeout(timeout);resolve(result);};
      child.stdout.on('data',d=>{stdout=(stdout+d.toString()).slice(-20000);});
      child.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-20000);});
      const monitor=setInterval(()=>{
        const evaluation=this.refreshHardware();
        if(evaluation.severity==='STOP'){
          stoppedBy=evaluation.reasons.join(','); try{child.kill();}catch{}
        } else if(evaluation.severity==='PAUSE'){
          highPressure++; if(highPressure>=3){stoppedBy='SUSTAINED_RESOURCE_PRESSURE';try{child.kill();}catch{}}
        } else highPressure=0;
      },5000);
      const timeout=setTimeout(()=>{stoppedBy='TIMEOUT';try{child.kill();}catch{};},timeoutMs);
      child.on('error',e=>finish({exitCode:null,error:String(e.message||e),stdout,stderr,stoppedBy}));
      child.on('exit',code=>finish({exitCode:code,stdout,stderr,stoppedBy}));
    });
  }
  async runChecks(worktree,files){
    const checks=[];
    for(const file of files){
      const hardware=this.refreshHardware();
      if(!hardware.heavyWorkPermitted)return {ok:false,checks,blockedByHardware:hardware};
      const check=this.syntaxCheck(worktree,file); checks.push(check);
      if(check.exitCode!=null&&check.exitCode!==0)return {ok:false,checks};
    }
    const pre=this.refreshHardware(); if(!pre.heavyWorkPermitted)return {ok:false,checks,blockedByHardware:pre};
    const suite=await this.runGuarded('npm.cmd',['test'],worktree,300000);
    checks.push({file:null,command:'npm.cmd test',...suite});
    return {ok:suite.exitCode===0&&!suite.stoppedBy,checks,blockedByHardware:suite.stoppedBy?this.hardwareState:null};
  }
  commitCandidate(git,worktree,candidateId,summary){
    spawnSync(git,['add','--all'],{cwd:worktree,windowsHide:true,timeout:30000});
    const p=spawnSync(git,['commit','-m',`Orion improvement ${candidateId}: ${String(summary).slice(0,120)}`],
      {cwd:worktree,encoding:'utf8',windowsHide:true,timeout:60000});
    if(p.status!==0)throw new Error('Candidate commit failed: '+String(p.stderr||p.stdout));
    const h=spawnSync(git,['rev-parse','HEAD'],{cwd:worktree,encoding:'utf8',windowsHide:true,timeout:10000});
    return String(h.stdout||'').trim();
  }
  async promoteCandidate({git,worktree,branch,candidateId,summary}){
    if(!this.autoPromote)return {status:'QUALIFIED_NOT_AUTO_PROMOTED'};
    const status=spawnSync(git,['status','--porcelain'],{cwd:this.repoRoot,encoding:'utf8',windowsHide:true,timeout:10000});
    if(String(status.stdout||'').trim())return {status:'PROMOTION_BLOCKED_DIRTY_BASELINE'};
    const head=spawnSync(git,['rev-parse','HEAD'],{cwd:this.repoRoot,encoding:'utf8',windowsHide:true,timeout:10000});
    const rollbackCommit=String(head.stdout||'').trim();
    const candidateCommit=this.commitCandidate(git,worktree,candidateId,summary);
    const merge=spawnSync(git,['merge','--no-ff',branch,'-m',`Promote Orion candidate ${candidateId}`],
      {cwd:this.repoRoot,encoding:'utf8',windowsHide:true,timeout:120000});
    if(merge.status!==0){spawnSync(git,['merge','--abort'],{cwd:this.repoRoot,windowsHide:true,timeout:30000});return {status:'PROMOTION_MERGE_FAILED',rollbackCommit,candidateCommit,error:String(merge.stderr||merge.stdout)};}
    const validation=await this.runGuarded('npm.cmd',['test'],this.repoRoot,300000);
    if(validation.exitCode!==0||validation.stoppedBy){
      spawnSync(git,['reset','--hard',rollbackCommit],{cwd:this.repoRoot,windowsHide:true,timeout:60000});
      return {status:'PROMOTION_ROLLED_BACK',rollbackCommit,candidateCommit,validation};
    }
    return {status:'SOURCE_PROMOTED',rollbackCommit,candidateCommit,validation,
      deployment:'SOURCE_READY_FOR_SUITE_RELEASE_MANAGER'};
  }
  preserveCycle(cycle){
    const dir=path.join(this.root,'cycles');fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,`${cycle.startedAt.replace(/[:.]/g,'-')}-${cycle.candidateId||'frontier'}.json`);
    fs.writeFileSync(file,JSON.stringify(cycle,null,2),'utf8');
    this.append(this.backlogFile(),{candidateId:cycle.candidateId,status:cycle.status,track:cycle.track,summary:cycle.summary||null,cycleFile:file,at:new Date().toISOString()});
    return file;
  }
  async cycle(){
    if(!this.campaignActive()){this.stop();return this.writeStatus({status:'CAMPAIGN_COMPLETE'});}
    if(this.running)return this.writeStatus({note:'cycle-already-running'});
    const hardware=this.refreshHardware();
    if(!hardware.heavyWorkPermitted)return this.writeStatus({status:'THROTTLED',reason:hardware.reasons});
    if(!this.historyIndex)this.refreshHistory();
    this.running=true; this.cycleCount++;
    const track=this.cycleCount%2===0?'IDEA_REALIZATION':'PLATFORM_EVOLUTION';
    const cycle={startedAt:new Date().toISOString(),track,status:'DISCOVERING',candidateId:null,summary:null,frontier:null,validation:null,promotion:null};
    try{
      cycle.frontier=await this.discover(track); cycle.status='DRAFTING';
      const candidate=await this.draftCandidate(track,cycle.frontier);
      cycle.candidateId=String(candidate.candidateId||crypto.randomUUID()); cycle.summary=String(candidate.summary||'Orion improvement candidate');
      cycle.candidate={...candidate,files:undefined};
      const files=this.validateCandidate(candidate); const workspace=this.makeWorktree(cycle.candidateId);
      cycle.worktree=workspace.worktree;cycle.branch=workspace.branch;cycle.status='TESTING';
      this.applyFiles(workspace.worktree,files); cycle.validation=await this.runChecks(workspace.worktree,files);
      cycle.files=files.map(file=>({path:file.path,sha256:crypto.createHash('sha256').update(file.content).digest('hex')}));
      if(!cycle.validation.ok)cycle.status='FAILED_PRESERVED';
      else{
        cycle.status='QUALIFIED';
        cycle.promotion=await this.promoteCandidate({...workspace,candidateId:cycle.candidateId,summary:cycle.summary});
        cycle.status=cycle.promotion.status==='SOURCE_PROMOTED'?'SOURCE_PROMOTED':cycle.promotion.status;
      }
    }catch(error){cycle.status='FAILED_PRESERVED';cycle.error=String(error.message||error);}
    finally{
      cycle.completedAt=new Date().toISOString();const cycleFile=this.preserveCycle(cycle);
      this.vault?.append('orion-improvement-cycle','orion',{candidateId:cycle.candidateId,status:cycle.status,track,summary:cycle.summary,cycleFile,promotion:cycle.promotion});
      this.experience?.append('orion-improvement-cycle',{candidateId:cycle.candidateId,status:cycle.status,track,cycleFile},{sourceClass:'DERIVED_SELF_IMPROVEMENT'});
      this.running=false;this.writeStatus({lastCycle:{candidateId:cycle.candidateId,status:cycle.status,track,completedAt:cycle.completedAt,cycleFile}});
    }
    return cycle;
  }
  start(){
    if(!this.campaignActive())return this.writeStatus({status:'CAMPAIGN_COMPLETE'});
    this.refreshHardware(); this.refreshHistory();
    if(!this.hardwareTimer)this.hardwareTimer=setInterval(()=>{try{this.refreshHardware();}catch{}},30000);
    if(!this.historyTimer)this.historyTimer=setInterval(()=>{try{this.refreshHistory();}catch{}},6*60*60*1000);
    if(!this.timer)this.timer=setInterval(()=>this.cycle().catch(()=>{}),this.intervalMs);
    setTimeout(()=>this.cycle().catch(()=>{}),30000);
    const remaining=Math.max(0,this.campaignEnd.getTime()-Date.now());
    setTimeout(()=>this.stop(),Math.min(remaining,2147483647));
    return this.writeStatus({status:'RUNNING',startedAt:new Date().toISOString()});
  }
  stop(){
    if(this.timer)clearInterval(this.timer);if(this.hardwareTimer)clearInterval(this.hardwareTimer);if(this.historyTimer)clearInterval(this.historyTimer);
    this.timer=null;this.hardwareTimer=null;this.historyTimer=null;
    return this.writeStatus({status:this.campaignActive()?'STOPPED':'CAMPAIGN_COMPLETE',stoppedAt:new Date().toISOString()});
  }
}

module.exports={OrionImprovementLoop};
