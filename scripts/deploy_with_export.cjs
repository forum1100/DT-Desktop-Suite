const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const target=path.join(process.env.USERPROFILE,'Desktop','DT Works Suite','Programs','DT Desktop Suite.exe');
const backup=path.join(process.env.USERPROFILE,'Desktop','DT Works Suite','Programs','DT Desktop Suite.previous.exe');
const source=path.join(root,'dist','DT Desktop Suite 0.1.0.exe');
const setupSource=path.join(root,'dist','DT Desktop Suite Setup 0.1.0.exe');
const setupTarget=path.join(process.env.USERPROFILE,'Desktop','DT Works Suite','Installers','DT Desktop Suite Setup.exe');
cp.execFileSync(process.execPath,[path.join(__dirname,'pre_restart_export.cjs')],{stdio:'inherit'});
const ps=`Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '${target.replace(/'/g,"''")}' } | Select-Object -ExpandProperty ProcessId`;
let pids=[]; try { pids=cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean); } catch {}
for(const pid of pids){ try{cp.execFileSync('taskkill.exe',['/PID',pid,'/T','/F'],{stdio:'ignore'});}catch{} }
for(let i=0;i<20;i++){try{if(fs.existsSync(backup))fs.rmSync(backup,{force:true});if(fs.existsSync(target))fs.renameSync(target,backup);break;}catch(e){if(i===19)throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500);}}
fs.copyFileSync(source,target);fs.copyFileSync(setupSource,setupTarget);
const a=fs.readFileSync(source);const b=fs.readFileSync(target);const crypto=require('node:crypto');const h=x=>crypto.createHash('sha256').update(x).digest('hex');if(h(a)!==h(b))throw new Error('deployed executable hash mismatch');
cp.spawn(target,[],{detached:true,stdio:'ignore',cwd:path.dirname(target)}).unref();
console.log(JSON.stringify({deployed:true,sourceHash:h(a),target,pidsClosed:pids},null,2));