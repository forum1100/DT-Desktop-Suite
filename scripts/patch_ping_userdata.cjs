const fs=require('node:fs');
const p='C:/Users/thoma/Documents/GitHub/DT-Desktop-Suite/apps/desktop/src/main.cjs';
let s=fs.readFileSync(p,'utf8');
const needle="let vault, keys, broker, gateway, recovery, supervisor;";
const insert="if (process.argv.includes('--grok-provider-ping')) app.setPath('userData', path.join(process.env.APPDATA, 'dt-desktop-suite'));\n\n"+needle;
if(!s.includes("app.setPath('userData', path.join(process.env.APPDATA, 'dt-desktop-suite'))")) s=s.replace(needle,insert);
fs.writeFileSync(p,s,'utf8');
console.log('bound one-shot to installed Suite userData');