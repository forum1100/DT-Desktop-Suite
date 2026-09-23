const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TEXT_EXT = new Set(['.txt','.md','.json','.jsonl','.html','.htm','.csv','.js','.cjs','.mjs','.ts','.tsx','.py','.ps1','.yaml','.yml']);
const METHOD_RE = /DT[_\s-]*CLOSEOUT|(?:source|ingestion|verbatim|export|divergence|branch|index|completion)[_\s-]*spark|Agent Foundry|perception point|closeout routine/ig;
const IDEA_RE = /(?:i want|we should|build|create|make|idea|app|program|platform|tool|system|feature|workflow|automation)[^\n\r]{0,220}/ig;

function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function walk(roots, maxFiles=12000) {
  const out=[], stack=[...roots];
  while(stack.length && out.length<maxFiles){
    const current=stack.pop(); let entries=[];
    try{ entries=fs.readdirSync(current,{withFileTypes:true}); }catch{ continue; }
    for(const e of entries){
      const target=path.join(current,e.name);
      if(e.isDirectory()){ if(!/node_modules|\.git|dist|win-unpacked/i.test(target)) stack.push(target); continue; }
      if(!e.isFile() || !TEXT_EXT.has(path.extname(e.name).toLowerCase())) continue;
      try{ const st=fs.statSync(target); if(st.size<=8*1024*1024) out.push({path:target,mtimeMs:st.mtimeMs,size:st.size}); }catch{}
      if(out.length>=maxFiles) break;
    }
  }
  return out;
}
function mineHistory(roots, options={}) {
  const files=walk(roots, Number(options.maxFiles)||12000);
  const prior=options.previousIndex || {};
  const priorFingerprints=prior.fileFingerprints || {};
  const currentFingerprints={};
  const methods=[], ideas=[];
  let reusedFiles=0, changedFiles=0;
  for(const file of files){
    const fingerprint=sha(file.path+'|'+file.size+'|'+file.mtimeMs);
    currentFingerprints[file.path]=fingerprint;
    if(priorFingerprints[file.path]===fingerprint){
      reusedFiles++;
      methods.push(...(prior.methods||[]).filter(row=>row.source===file.path));
      ideas.push(...(prior.ideas||[]).filter(row=>row.source===file.path));
      continue;
    }
    changedFiles++;
    let text; try{text=fs.readFileSync(file.path,'utf8');}catch{continue;}
    for(const match of text.matchAll(METHOD_RE)){
      const start=Math.max(0,match.index-220), end=Math.min(text.length,match.index+420);
      const excerpt=text.slice(start,end).replace(/\s+/g,' ').trim();
      methods.push({ source:file.path, modifiedMs:file.mtimeMs, term:match[0], excerpt, hash:sha(file.path+'|'+match.index+'|'+excerpt) });
    }
    for(const match of text.matchAll(IDEA_RE)){
      const excerpt=String(match[0]).replace(/\s+/g,' ').trim();
      if(excerpt.length<30) continue;
      ideas.push({ source:file.path, modifiedMs:file.mtimeMs, excerpt, hash:sha(file.path+'|'+match.index+'|'+excerpt) });
    }
  }
  const dedupe = rows => [...new Map(rows.map(row=>[row.hash,row])).values()];
  return { schema:'dt-history-method-index/1.1', generatedAt:new Date().toISOString(), roots,
    filesScanned:files.length, reusedFiles, changedFiles, fileFingerprints:currentFingerprints,
    methods:dedupe(methods), ideas:dedupe(ideas) };
}

function writeHistoryIndex(root, index) {
  fs.mkdirSync(root,{recursive:true});
  const file=path.join(root,'history-method-index.json');
  fs.writeFileSync(file,JSON.stringify(index,null,2),'utf8');
  return file;
}

module.exports = { mineHistory, writeHistoryIndex, walk };
