let selected = null;
let providers = [];
const nav = document.querySelector('#agents');
const panel = document.querySelector('#agent-panel');
const empty = document.querySelector('#empty');
const form = document.querySelector('#agent-form');
const result = document.querySelector('#result');

function choose(agent) {
  selected = agent;
  document.title = `${agent.name} — DT Desktop Suite`;
  empty.hidden = true; panel.hidden = false;
  document.documentElement.style.setProperty('--agent', agent.color);
  document.querySelector('#agent-name').textContent = agent.name;
  document.querySelector('#agent-purpose').textContent = agent.purpose;
  document.querySelector('#agent-status').textContent = agent.status;
  document.querySelector('#route-workflow').hidden = agent.id !== 'librarian';
  document.querySelector('#execute-workflow').hidden = agent.id !== 'librarian';
  document.querySelector('#run').hidden = agent.id === 'simulation-replay';
  document.querySelector('#replay-simulation').hidden = agent.id !== 'simulation-replay';
  refreshInbox(agent);
  document.querySelector('#brief-thesis').textContent = agent.brief?.thesis || '';
  document.querySelector('#brief-equation').textContent = agent.brief?.equation || '';
  document.querySelector('#brief-observed').textContent = agent.brief?.observed || '';
  document.querySelector('#brief-input').textContent = agent.brief?.input || '';
  document.querySelectorAll('.agent-button').forEach(button => button.classList.toggle('active', button.dataset.id === agent.id));
  form.replaceChildren(...agent.schema.map(field => {
    const label = document.createElement('label');
    label.textContent = field.replace(/([A-Z])/g, ' $1');
    const input = document.createElement('textarea');
    input.name = field; input.placeholder = `Enter ${label.textContent.toLowerCase()}…`;
    label.append(input); return label;
  }));
  result.textContent = 'Awaiting input.';
  if (agent.id === 'simulation-replay') {
    window.dt.listSimulations().then(items => {
      const runnable = items.filter(item => item.runnable);
      const field = form.querySelector('[name="simulationId"]');
      if (field && runnable[0]) field.value = runnable[0].simulationId;
      result.textContent = JSON.stringify({
        registry: items,
        runnableCount: runnable.length,
        note: 'Only registered runnable packs can execute. Unresolved historical claims remain visible and blocked.'
      }, null, 2);
    }).catch(error => { result.textContent = JSON.stringify({ error: error.message }, null, 2); });
  } else if (agent.id === 'agent-supervisor') {
    window.dt.operationsSnapshot().then(snapshot => {
      const field=form.querySelector('[name="workerSnapshot"]');
      if(field) field.value=JSON.stringify(snapshot.coordinator || { workers: [] }, null, 2);
      const desired=form.querySelector('[name="desiredMaxPerRole"]');
      if(desired) desired.value='3';
      result.textContent='Live coordinator snapshot loaded. Run bounded analysis to identify candidates; no worker will be terminated.';
    }).catch(error => { result.textContent = JSON.stringify({ error: error.message }, null, 2); });
  }
}

function updateProviderUI() {
  const id = document.querySelector('#provider').value;
  const current = providers.find(item => item.id === id);
  const defaults = {
    openai: 'gpt-5.2',
    anthropic: 'claude-sonnet-4-5',
    xai: 'grok-4',
    ollama: 'llama3.2',
    compatible: ''
  };
  document.querySelector('#model').value = defaults[id] || '';
  document.querySelector('#base-url').disabled = id !== 'compatible';
  const localOnly = id === 'ollama';
  document.querySelector('#provider-key').disabled = localOnly;
  document.querySelector('#save-provider').disabled = localOnly;
  document.querySelector('#provider-state').textContent = current?.hasCredential
    ? current.label + ' KEY STORED'
    : current?.keyRequired ? current.label + ' NEEDS KEY' : current?.label + ' READY';
}

function currentInput() {
  return form ? Object.fromEntries(new FormData(form)) : {};
}

async function refreshInbox(agent = selected) {
  const button = document.querySelector('#process-inbox');
  if (!agent || agent.id === 'librarian') {
    button.hidden = true;
    return;
  }
  try {
    const pending = await window.dt.getInbox(agent.id);
    button.hidden = false;
    document.querySelector('#inbox-count').textContent = '(' + pending.length + ')';
    button.disabled = pending.length === 0;
  } catch {
    button.hidden = true;
  }
}

let captureRecorder = null;
let captureStream = null;
let captureSession = null;
let captureChunkQueue = Promise.resolve();
let captureFinalizing = false;
let queuedControl = null;
let expectedTestAction = null;
let observedTestAction = null;
let controlCountdown = null;

async function loadCaptureSources() {
  const select=document.querySelector('#capture-source');
  const previous=select.value;
  const sources=await window.dt.listCaptureSources();
  select.replaceChildren(...sources.map(source=>{
    const option=document.createElement('option'); option.value=source.id;
    option.textContent=source.name+(source.displayId?' · display '+source.displayId:''); return option;
  }));
  if(previous&&sources.some(source=>source.id===previous)) select.value=previous;
  if(!sources.length){const option=document.createElement('option');option.value='';option.textContent='No capturable sources found';select.append(option);}
}

document.querySelector('#capture-refresh').addEventListener('click',()=>loadCaptureSources().catch(error=>setCaptureUI(false,error.message)));

function setCaptureUI(recording, message) {
  document.querySelector('#capture-state').textContent = message || (recording ? '● REC' : 'NOT RECORDING');
  document.querySelector('#capture-state').classList.toggle('recording', recording);
  document.querySelector('#capture-start').disabled = recording;
  document.querySelector('#capture-stop').disabled = !recording;
  document.querySelector('#capture-task').disabled = recording;
  document.querySelector('#grok-handshake').disabled = !recording;
}

async function finalizeCapture(status = 'COMPLETED') {
  if (!captureSession || captureFinalizing) return;
  captureFinalizing = true;
  const sessionId = captureSession.sessionId;
  try {
    await captureChunkQueue;
    const closed = await window.dt.stopCapture(sessionId, status);
    setCaptureUI(false, 'PRESERVED · ' + closed.manifest.videoBytes + ' BYTES');
  } catch (error) {
    setCaptureUI(false, 'CAPTURE FAILURE PRESERVED');
  } finally {
    document.querySelector('#capture-id').textContent = 'No active capture ID';
    document.querySelector('#grok-handshake-state').textContent = 'NOT CONNECTED';
    captureStream?.getTracks().forEach(track => track.stop());
    captureRecorder = null; captureStream = null; captureSession = null; queuedControl = null;
    clearInterval(controlCountdown); controlCountdown = null;
    const executeButton=document.querySelector('#control-execute');
    executeButton.disabled = true; executeButton.classList.remove('armed'); executeButton.textContent='STEP 6 — EXECUTE ONCE';
    document.querySelector('#control-abandon').hidden=true;
    document.querySelector('#control-state').textContent = 'NO ACTION QUEUED';
    captureChunkQueue = Promise.resolve(); captureFinalizing = false;
  }
}

document.querySelector('#capture-start').addEventListener('click', async () => {
  const task = document.querySelector('#capture-task').value.trim();
  if (!task) { setCaptureUI(false, 'TASK DESCRIPTION REQUIRED'); return; }
  try {
    const sourceId=document.querySelector('#capture-source').value;
    if(!sourceId) throw new Error('Select a screen or window to capture');
    captureStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } }
    });
    captureSession = await window.dt.startCapture({ task, agentId: selected?.id || null, sourceId });
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm';
    captureRecorder = new MediaRecorder(captureStream, { mimeType });
    captureRecorder.ondataavailable = event => {
      if (!event.data.size || !captureSession) return;
      const sessionId = captureSession.sessionId;
      captureChunkQueue = captureChunkQueue.then(async () => {
        const bytes = new Uint8Array(await event.data.arrayBuffer());
        await window.dt.appendCapture(sessionId, bytes);
      });
    };
    captureRecorder.onstop = () => finalizeCapture('COMPLETED');
    captureStream.getVideoTracks()[0].addEventListener('ended', () => {
      if (captureRecorder?.state === 'recording') captureRecorder.stop();
    });
    captureRecorder.start(1500);
    document.querySelector('#capture-id').textContent = captureSession.sessionId;
    document.querySelector('#grok-handshake-state').textContent = 'WAITING FOR GROK PROPOSAL';
    setCaptureUI(true, '● REC · TASK BOUND');
  } catch (error) {
    captureStream?.getTracks().forEach(track => track.stop());
    captureStream = null; captureSession = null; captureRecorder = null;
    setCaptureUI(false, 'CAPTURE NOT STARTED · ' + (error.name || 'ERROR'));
    document.querySelector('#control-preview').textContent = JSON.stringify({
      captureError: error.message || String(error),
      errorName: error.name || null,
      nextStep: 'Confirm the Windows screen-picker selection and retry.'
    }, null, 2);
  }
});

document.querySelector('#capture-stop').addEventListener('click', () => {
  if (captureRecorder?.state === 'recording') captureRecorder.stop();
});

document.querySelector('#grok-handshake').addEventListener('click', async () => {
  const state = document.querySelector('#grok-handshake-state');
  if (!captureSession || captureRecorder?.state !== 'recording') {
    state.textContent = 'ACTIVE CAPTURE REQUIRED';
    return;
  }
  state.textContent = 'POLLING GROK MAILBOX…';
  try {
    const result = await window.dt.processGrokHandshake({ captureSessionId: captureSession.sessionId });
    state.textContent = result.status || result.connectionStatus || 'NOT CONNECTED';
  } catch (error) {
    state.textContent = 'HANDSHAKE ERROR · ' + error.message;
  }
});

const testPad=document.querySelector('#cursor-test-pad');
const scrollPad=document.querySelector('#cursor-scroll-pad');
testPad.addEventListener('mouseenter',()=>{observedTestAction='MOVE';});
testPad.addEventListener('click',()=>{observedTestAction='LEFT_CLICK';});
testPad.addEventListener('contextmenu',event=>{event.preventDefault();observedTestAction='RIGHT_CLICK';});
scrollPad.addEventListener('scroll',()=>{observedTestAction='SCROLL';});

function disarmControl() {
  clearInterval(controlCountdown); controlCountdown=null;
  const executeButton=document.querySelector('#control-execute');
  executeButton.disabled=true; executeButton.classList.remove('armed');
  executeButton.textContent='STEP 6 — EXECUTE ONCE';
  document.querySelector('#control-abandon').hidden=true;
  document.querySelector('#capture-stop').disabled=!captureSession;
}

async function abandonQueuedControl(reason='USER_ABANDONED') {
  if(!queuedControl)return;
  const preview=document.querySelector('#control-preview');
  try {
    const canceled=await window.dt.cancelControl(queuedControl.token,reason);
    preview.textContent=JSON.stringify({notExecuted:canceled.event,evidence:'Failure branch preserved.'},null,2);
    document.querySelector('#control-state').textContent='NOT EXECUTED · PRESERVED';
  } catch(error) { preview.textContent=JSON.stringify({error:error.message},null,2); }
  finally { queuedControl=null; disarmControl(); }
}

document.querySelector('#control-abandon').addEventListener('click',()=>abandonQueuedControl());

document.querySelector('#control-prepare-test').addEventListener('click',()=>{
  const action=document.querySelector('#control-action').value;
  const target=action==='SCROLL'?scrollPad:testPad;
  const rect=target.getBoundingClientRect();
  const chromeTop=Math.max(0,window.outerHeight-window.innerHeight);
  const x=Math.round(window.screenX+rect.left+rect.width/2);
  const y=Math.round(window.screenY+chromeTop+rect.top+Math.min(rect.height/2,36));
  if(action==='SCROLL') scrollPad.scrollTop=0;
  const scrollAmount=action==='SCROLL'?-240:0;
  document.querySelector('#control-x').value=x;
  document.querySelector('#control-y').value=y;
  document.querySelector('#control-scroll').value=scrollAmount;
  document.querySelector('#capture-task').value='DT_CURSOR_TEST action='+action+' X='+x+' Y='+y+' SCROLL='+scrollAmount+
    '. Operate only on the internal safe test pad. Do not interact with another application or modify user data.';
  expectedTestAction=action; observedTestAction=null;
  document.querySelector('#control-preview').textContent=JSON.stringify({
    test:'INTERNAL_SAFE_PAD',action,x,y,scrollAmount,next:'Start authorized capture, then preview and queue.'
  },null,2);
});

document.querySelector('#control-queue').addEventListener('click', async () => {
  const preview=document.querySelector('#control-preview');
  if(!captureSession){preview.textContent='Active authorized screen capture required.';return;}
  try{
    const xValue=document.querySelector('#control-x').value.trim();
    const yValue=document.querySelector('#control-y').value.trim();
    if(xValue===''||yValue==='') throw new Error('Enter both Screen X and Screen Y; blanks cannot become zero.');
    queuedControl=await window.dt.queueControl({
      sessionId:captureSession.sessionId,
      action:document.querySelector('#control-action').value,
      x:Number(xValue),
      y:Number(yValue),
      scrollAmount:Number(document.querySelector('#control-scroll').value||0)
    });
    preview.textContent=JSON.stringify({action:queuedControl.action,x:queuedControl.x,y:queuedControl.y,
      scrollAmount:queuedControl.scrollAmount,expiresAt:queuedControl.expiresAt,
      warning:'This exact action will execute once. Outcome remains unverified until observed.'},null,2);
    const executeButton=document.querySelector('#control-execute');
    const expiresAt=Date.parse(queuedControl.expiresAt);
    executeButton.disabled=false; executeButton.classList.add('armed');
    document.querySelector('#control-abandon').hidden=false;
    document.querySelector('#capture-stop').disabled=true;
    const updateCountdown=()=>{
      const seconds=Math.max(0,Math.ceil((expiresAt-Date.now())/1000));
      executeButton.textContent='STEP 6 — EXECUTE ONCE · '+seconds+'s';
      document.querySelector('#control-state').textContent='ACTION QUEUED · EXECUTION REQUIRED · '+seconds+'s';
      if(seconds===0){clearInterval(controlCountdown);controlCountdown=null;abandonQueuedControl('APPROVAL_EXPIRED_NOT_EXECUTED');}
    };
    clearInterval(controlCountdown); updateCountdown(); controlCountdown=setInterval(updateCountdown,250);
    executeButton.scrollIntoView({behavior:'smooth',block:'center'}); executeButton.focus();
  }catch(error){queuedControl=null;preview.textContent=JSON.stringify({error:error.message},null,2);}
});

document.querySelector('#control-execute').addEventListener('click', async () => {
  const preview=document.querySelector('#control-preview');
  if(!queuedControl)return;
  clearInterval(controlCountdown); controlCountdown=null;
  const executeButton=document.querySelector('#control-execute');
  executeButton.disabled=true; executeButton.classList.remove('armed'); executeButton.textContent='EXECUTING ONCE…';
  document.querySelector('#control-abandon').hidden=true;
  try{
    const executed=await window.dt.executeControl(queuedControl.token);
    preview.textContent=JSON.stringify(executed,null,2);
    document.querySelector('#control-state').textContent='EXECUTED · CHECKING TEST PAD';
    setTimeout(async()=>{
      const passed=expectedTestAction===observedTestAction;
      try {
        const recorded=await window.dt.recordControlTest({sessionId:captureSession?.sessionId,
          expected:expectedTestAction,observed:observedTestAction});
        preview.textContent=JSON.stringify({execution:executed.event,test:recorded.result,
          evidence:'Recorded in control-events.jsonl and the append-only DT vault.'},null,2);
        document.querySelector('#control-state').textContent=passed?'SAFE TEST PASS · RECORDED':'SAFE TEST NOT OBSERVED · RECORDED';
      } catch (recordError) {
        preview.textContent=JSON.stringify({execution:executed.event,expected:expectedTestAction,
          observed:observedTestAction,status:passed?'PASS':'FAIL_OR_NOT_OBSERVED',recordingError:recordError.message},null,2);
        document.querySelector('#control-state').textContent='TEST RESULT COULD NOT BE RECORDED';
      }
    },700);
  }catch(error){preview.textContent=JSON.stringify({error:error.message},null,2);}
  finally{queuedControl=null;disarmControl();}
});

let operationsMode = 'main';
const fmtTime = ms => ms < 1000 ? Math.round(ms) + ' ms'
  : ms < 60000 ? (ms/1000).toFixed(1) + ' s'
  : (ms/60000).toFixed(1) + ' min';
async function refreshOperations() {
  try {
    const data = await window.dt.operationsSnapshot();
    const rows = operationsMode === 'agent' && selected
      ? data.agents.filter(row => row.agentId === selected.id) : data.agents;
    document.querySelector('#ops-summary').innerHTML =
      '<b>' + data.active.length + '</b><span>active now</span><b>' +
      data.totals.runs + '</b><span>recorded runs</span><b>' +
      fmtTime(data.suiteUptimeMs) + '</b><span>suite uptime</span><b>' +
      data.totals.failures + '</b><span>failures preserved</span>';
    const max = Math.max(1, ...rows.map(row => row.durationMs));
    document.querySelector('#ops-graph').replaceChildren(...rows.map(row => {
      const line=document.createElement('div'); line.className='ops-row';
      const name=document.createElement('span'); name.textContent=row.agentId;
      const track=document.createElement('i'); const bar=document.createElement('em');
      bar.style.width=Math.max(2,(row.durationMs/max)*100)+'%'; track.append(bar);
      const value=document.createElement('b');
      value.textContent=(row.active?'LIVE · ':'')+row.runs+' runs · '+fmtTime(row.durationMs);
      line.append(name,track,value); return line;
    }));
  } catch {}
}
document.querySelector('#ops-main').addEventListener('click', () => { operationsMode='main'; refreshOperations(); });
document.querySelector('#ops-agent').addEventListener('click', () => { operationsMode='agent'; refreshOperations(); });

async function boot() {
  await new Promise(resolve => setTimeout(resolve, 150));
  const hub = await window.dt.hubStatus();
  const hubStatus = document.querySelector('#hub-status');
  hubStatus.childNodes[1].textContent = hub.online ? ' LOCAL HUB ONLINE ' : hub.shared ? ' SHARED HUB DETECTED ' : ' LOCAL HUB OFFLINE ';
  const agents = await window.dt.listAgents();
  for (const agent of agents) {
    const button = document.createElement('button');
    button.className = 'agent-button'; button.dataset.id = agent.id;
    button.style.setProperty('--agent', agent.color);
    button.innerHTML = `<i class="dot"></i><span><strong>${agent.name}</strong><small>${agent.status}</small></span>`;
    button.addEventListener('click', () => choose(agent));
    nav.append(button);
  }
  await loadCaptureSources();
  providers = await window.dt.listProviders();
  const providerSelect = document.querySelector('#provider');
  for (const provider of providers) {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.label;
    providerSelect.append(option);
  }
  providerSelect.addEventListener('change', updateProviderUI);
  updateProviderUI();
  const requested = new URLSearchParams(location.search).get('agent');
  if (requested) choose(agents.find(agent => agent.id === requested) || agents[0]);
  await refreshOperations();
  setInterval(refreshOperations, 2000);
}

document.querySelector('#run').addEventListener('click', async () => {
  if (!selected) return;
  const input = Object.fromEntries(new FormData(form));
  for (const key of ['sources']) {
    if (input[key]) input[key] = input[key].split(/\r?\n/).filter(Boolean);
  }
  result.textContent = 'Running local preflight…';
  try {
    const response = await window.dt.runAgent(selected.id, input);
    result.textContent = JSON.stringify(response, null, 2);
    await refreshOperations();
  } catch (error) {
    result.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});

document.querySelector('#replay-simulation').addEventListener('click', async () => {
  if (selected?.id !== 'simulation-replay') return;
  const input = currentInput();
  result.textContent = 'Running registered simulation and preserving receipt…';
  try {
    const replayed = await window.dt.replaySimulation({
      ...input,
      extraArgs: String(input.extraArgs || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean)
    });
    result.textContent = JSON.stringify(replayed, null, 2);
    await refreshOperations();
  } catch (error) {
    result.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});

document.querySelector('#route-workflow').addEventListener('click', async () => {
  if (selected?.id !== 'librarian') return;
  const input = currentInput();
  result.textContent = 'Creating signed routing envelopes…';
  try {
    const routed = await window.dt.routeWorkflow(input);
    result.textContent = JSON.stringify({
      routes: routed.routes,
      delivered: routed.messages.map(message => ({
        id: message.id,
        recipient: message.recipient,
        sourceClass: message.sourceClass,
        hash: message.hash
      })),
      failures: routed.failures,
      checkpoint: routed.checkpoint
    }, null, 2);
  } catch (error) {
    result.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});

document.querySelector('#execute-workflow').addEventListener('click', async () => {
  if (selected?.id !== 'librarian') return;
  result.textContent = 'Routing, processing, and collecting signed responses…';
  try {
    const completed = await window.dt.executeWorkflow(currentInput());
    result.textContent = JSON.stringify({
      routes: completed.routed.routes,
      tasks: completed.routed.messages.map(message => message.id),
      executions: completed.executions.map(run => ({
        agentId: run.agentId,
        processed: run.processed.length,
        responseIds: run.processed.map(item => item.response.id),
        failures: run.failures
      })),
      completion: completed.completion
    }, null, 2);
  } catch (error) {
    result.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});

document.querySelector('#process-inbox').addEventListener('click', async () => {
  if (!selected || selected.id === 'librarian') return;
  result.textContent = 'Verifying and processing pending task envelopes…';
  try {
    const processed = await window.dt.processInbox(selected.id);
    result.textContent = JSON.stringify({
      agentId: processed.agentId,
      received: processed.pendingBeforeRun,
      responses: processed.processed.map(item => ({
        taskId: item.message.id,
        responseId: item.response.id,
        parentId: item.response.parentId,
        state: item.result.state,
        requiredFields: item.result.requiredFields
      })),
      failures: processed.failures,
      pending: processed.pendingAfterRun
    }, null, 2);
    await refreshInbox(selected);
  } catch (error) {
    result.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});

document.querySelector('#save-provider').addEventListener('click', async () => {
  const id = document.querySelector('#provider').value;
  const key = document.querySelector('#provider-key');
  const state = document.querySelector('#provider-state');
  try {
    await window.dt.storeProvider(id, key.value);
    key.value = '';
    providers = await window.dt.listProviders();
    updateProviderUI();
  } catch (error) {
    state.textContent = error.message;
  }
});

document.querySelector('#ask-ai').addEventListener('click', async () => {
  const output = document.querySelector('#ai-result');
  output.hidden = false;
  if (!captureSession || captureRecorder?.state !== 'recording') {
    output.textContent = JSON.stringify({ error: 'Start an authorized task capture before using a connected AI.' }, null, 2);
    return;
  }
  output.textContent = 'Contacting selected provider under active task capture…';
  try {
    const response = await window.dt.askProvider({
      provider: document.querySelector('#provider').value,
      model: document.querySelector('#model').value.trim(),
      baseUrl: document.querySelector('#base-url').value.trim(),
      prompt: document.querySelector('#ai-prompt').value,
      agentId: selected?.id || null,
      input: currentInput(),
      captureSessionId: captureSession.sessionId
    });
    output.textContent = response.text + '\n\nSafety receipt:\n' + JSON.stringify(response.safety, null, 2);
  } catch (error) {
    output.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});

document.querySelector('#export-vault').addEventListener('click', async () => {
  const state = document.querySelector('#vault-state');
  state.textContent = 'Verifying chain and preparing export…';
  try {
    const exported = await window.dt.exportVault();
    state.textContent = exported.canceled
      ? 'Export canceled; local history unchanged.'
      : 'Exported ' + exported.recordCount + ' records. Hash: ' + exported.bundleHash.slice(0, 12) + '…';
  } catch (error) {
    state.textContent = error.message;
  }
});

document.querySelector('#import-vault').addEventListener('click', async () => {
  const state = document.querySelector('#vault-state');
  state.textContent = 'Checking imported hashes before acceptance…';
  try {
    const imported = await window.dt.importVault();
    state.textContent = imported.canceled
      ? 'Import canceled; local history unchanged.'
      : 'Verified ' + imported.verified.recordCount + ' imported records; original chain archived.';
  } catch (error) {
    state.textContent = error.message;
  }
});

boot().catch(error => { result.textContent = error.stack; });

const adminDialog = document.querySelector('#admin-dialog');
document.querySelector('#admin-open').addEventListener('click', async () => {
  adminDialog.showModal();
  const status = await window.dt.ownerStatus();
  document.querySelector('#owner-state').textContent = status.verified
    ? `Verified GitHub owner: ${status.authenticatedLogin}`
    : `Expected forum1100; authenticated: ${status.authenticatedLogin || 'none'}`;
});
document.querySelector('#admin-close').addEventListener('click', () => adminDialog.close());
document.querySelector('#owner-setup').addEventListener('click', async () => {
  const output = document.querySelector('#owner-output');
  output.textContent = 'Verifying owner and issuing one-time credentials…';
  try {
    const setup = await window.dt.ownerSetup();
    output.textContent = JSON.stringify(setup, null, 2);
  } catch (error) {
    output.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});

document.querySelector('#owner-recover').addEventListener('click', async () => {
  const output = document.querySelector('#owner-output');
  const ticket = document.querySelector('#recovery-ticket').value.trim();
  output.textContent = 'Verifying forum1100 and redeeming ticket…';
  try {
    const restored = await window.dt.ownerRecover(ticket);
    output.textContent = JSON.stringify(restored, null, 2);
    document.querySelector('#recovery-ticket').value = '';
  } catch (error) {
    output.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});
