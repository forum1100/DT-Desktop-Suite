const fs=require('node:fs');
const p='C:/Users/thoma/Documents/GitHub/DT-Desktop-Suite/apps/desktop/src/main.cjs';
let s=fs.readFileSync(p,'utf8');
if(!s.includes("model:'grok-4'")) throw new Error('grok-4 marker missing');
s=s.replace("model:'grok-4'","model:'grok-4.6'");
fs.writeFileSync(p,s,'utf8');
console.log('updated one-shot model to grok-4.6');
