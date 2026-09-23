const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))}catch{return null}}
function dataRoot(){return process.env.DT_PERSONAL_PRO_DATA_DIR||path.join(os.homedir(),'TJ_Personal_Pro','data')}
function loadPerceptionContext(){const root=dataRoot();const screen=readJson(path.join(root,'device_profile','screen_environment.json'));const observer=readJson(path.join(root,'self_observer','manifest.json'));const recent=(observer?.recent_segments||[]).slice(-3).map(x=>({file:path.basename(String(x.path||'')),bytes:x.bytes||0,modified:x.modified||null}));return{schema:'dt-perception-context/1.0',capturedAt:new Date().toISOString(),screenEnvironment:screen,selfObserver:observer?{state:observer.state,allConnectedScreens:observer.all_connected_screens,captureMode:observer.capture_mode,settings:observer.settings,recentSegments:recent}:null}}
module.exports={loadPerceptionContext,dataRoot};
