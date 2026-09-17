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

const trainingStoreKey = 'dt.training.lessons.v1';
let trainingDraft = null;

async function refreshTrainingMailbox() {
  try {
    const status = await window.dt.aiMailboxStatus();
    const peer = status.peers.find(item => item.peerId === document.querySelector('#training-mailbox').value);
    document.querySelector('#training-mailbox-state').textContent = peer
      ? peer.peerId.toUpperCase() + ' MAILBOX · IN ' + peer.inbound + ' · OUT ' + peer.outbound
      : 'MAILBOX UNAVAILABLE';
  } catch (error) {
    document.querySelector('#training-mailbox-state').textContent = 'MAILBOX ERROR';
  }
}

function trainingLessons() {
  try { return JSON.parse(localStorage.getItem(trainingStoreKey) || '[]'); }
  catch { return []; }
}

function renderTrainingHistory() {
  const history = trainingLessons();
  const output = document.querySelector('#training-history');
  output.textContent = history.length
    ? history.slice(-5).reverse().map(item => {
      const provider = item.provider ? ' · ' + item.provider : '';
      return '[' + item.createdAt + '] ' + item.status + provider + ' · ' + item.observation.slice(0, 140);
    }).join('\n')
    : 'No local lessons recorded yet.';
}

function trainingPrompt(observation) {
  const agent = selected?.name || 'DT Desktop Suite';
  return [
    'You are a teaching peer assisting the DT Desktop Suite.',
    'Do not claim validation. Separate observed facts, instructions, assumptions, uncertainties, and proposed tests.',
    'Preserve failed branches and explain what evidence would falsify or correct the lesson.',
    'Return a concise procedure, prerequisites, expected result, failure modes, and a verification test.',
    'Current DT program: ' + agent,
    '',
    'New direction or explanation:',
    observation
  ].join('\n');
}

function classifyTrainingProviderFailure(error) {
  const message = String(error?.message || error);
  if (/\\b401\\b/.test(message)) return 'AUTHENTICATION FAILED · RECONNECT PROVIDER · NO AUTOMATIC RETRY';
  if (/\\b403\\b/.test(message)) return 'AUTHORIZATION DENIED · CHECK PROVIDER SCOPE';
  if (/\\b429\\b/.test(message)) return 'RATE LIMITED · BOUNDED RETRY REQUIRED';
  if (/\\b5\\d{2}\\b/.test(message)) return 'PROVIDER UNAVAILABLE · FAILURE PRESERVED';
  return 'AUTO HANDOFF FAILED · COPY MODE AVAILABLE';
}

async function activateTrainingPrompt() {
  const observation = document.querySelector('#training-observation').value.trim();
  const state = document.querySelector('#training-state');
  if (!observation) { state.textContent = 'DESCRIBE A NEW DIRECTION FIRST'; return; }
  trainingDraft = { observation, prompt: trainingPrompt(observation), createdAt: new Date().toISOString() };
  document.querySelector('#training-prompt').value = trainingDraft.prompt;
  document.querySelector('#training-copy').disabled = false;
  document.querySelector('#training-mailbox-write').disabled = false;
  document.querySelector('#training-save').disabled = true;
  state.textContent = 'PROMPT READY · LOCAL';
  const auto = document.querySelector('#training-auto-send').checked;
  if (auto) {
    if (!captureSession || captureRecorder?.state !== 'recording') {
      state.textContent = 'AUTO HANDOFF REQUIRES ACTIVE CAPTURE';
      return;
    }
    state.textContent = 'AUTO HANDOFF IN PROGRESS…';
    try {
      const response = await window.dt.askProvider({
        provider: document.querySelector('#provider').value,
        model: document.querySelector('#model').value.trim(),
        baseUrl: document.querySelector('#base-url').value.trim(),
        prompt: trainingDraft.prompt,
        agentId: selected?.id || 'training-bot',
        input: { observation, mode: 'training-bot-auto-handoff' },
        captureSessionId: captureSession.sessionId
      });
      document.querySelector('#training-reply').value = response.text || '';
      trainingDraft.provider = document.querySelector('#provider').value;
      trainingDraft.safety = response.safety || null;
      state.textContent = 'AI RESPONSE RECEIVED · REVIEW BEFORE SAVING';
      document.querySelector('#training-save').disabled = !response.text;
    } catch (error) {
      state.textContent = classifyTrainingProviderFailure(error);
      document.querySelector('#training-reply').value = JSON.stringify({
        error: error.message,
        classification: state.textContent,
        nextStep: /401/.test(String(error?.message || error)) ? 'Reconnect the selected provider and run a harmless status test before retrying.' : 'Preserve the failure and use copy mode if appropriate.'
      }, null, 2);
    }
  }
}

document.querySelector('#training-observation').addEventListener('input', event => {
  if (event.target.value.trim().length > 20) document.querySelector('#training-state').textContent = 'NEW TRAINING CANDIDATE';
});

document.querySelector('#training-auto-send').addEventListener('change', event => {
  document.querySelector('#training-state').textContent = event.target.checked ? 'AUTO HANDOFF ON · CAPTURE-BOUND' : 'COPY/PASTE MODE';
  document.querySelector('#training-disclosure').textContent = event.target.checked
    ? 'Automatic handoff is on for this session. Only activated training prompts go to the selected provider, under visible capture and local logging.'
    : 'Automatic handoff is off. Nothing is sent automatically; copy/paste mode remains available.';
});

document.querySelector('#training-activate').addEventListener('click', () => activateTrainingPrompt().catch(error => {
  document.querySelector('#training-state').textContent = 'TRAINING ACTIVATION FAILED';
  document.querySelector('#training-reply').value = error.message;
}));

document.querySelector('#training-copy').addEventListener('click', async () => {
  const prompt = document.querySelector('#training-prompt').value;
  if (!prompt) return;
  try {
    await navigator.clipboard.writeText(prompt);
    document.querySelector('#training-state').textContent = 'PROMPT COPIED · WAITING FOR AI REPLY';
  } catch {
    document.querySelector('#training-prompt').select();
    document.querySelector('#training-state').textContent = 'SELECTED · PRESS CTRL+C';
  }
  document.querySelector('#training-save').disabled = !document.querySelector('#training-reply').value.trim();
});

document.querySelector('#training-reply').addEventListener('input', event => {
  document.querySelector('#training-save').disabled = !trainingDraft || !event.target.value.trim();
});

document.querySelector('#training-save').addEventListener('click', () => {
  if (!trainingDraft) return;
  const reply = document.querySelector('#training-reply').value.trim();
  if (!reply) return;
  const record = {
    ...trainingDraft,
    reply,
    provider: trainingDraft.provider || 'manual-copy-paste',
    status: 'pending-human-validation',
    savedAt: new Date().toISOString()
  };
  const history = trainingLessons();
  history.push(record);
  localStorage.setItem(trainingStoreKey, JSON.stringify(history));
  document.querySelector('#training-state').textContent = 'LESSON SAVED LOCALLY · PENDING VALIDATION';
  document.querySelector('#training-save').disabled = true;
  renderTrainingHistory();
});

renderTrainingHistory();
document.querySelector('#training-mailbox').addEventListener('change', refreshTrainingMailbox);
document.querySelector('#training-mailbox-write').addEventListener('click', async () => {
  if (!trainingDraft) return;
  const peerId = document.querySelector('#training-mailbox').value;
  try {
    const written = await window.dt.aiMailboxWrite({
      peerId,
      direction: 'outbound',
      payload: {
        kind: 'training-prompt',
        prompt: trainingDraft.prompt,
        observation: trainingDraft.observation,
        agentId: selected?.id || 'training-bot',
        replyExpected: true
      }
    });
    trainingDraft.mailbox = written.path;
    document.querySelector('#training-state').textContent = 'PROMPT WRITTEN TO ' + peerId.toUpperCase() + ' MAILBOX';
    refreshTrainingMailbox();
  } catch (error) {
    document.querySelector('#training-state').textContent = 'MAILBOX WRITE FAILED';
  }
});
document.querySelector('#training-mailbox-poll').addEventListener('click', async () => {
  const peerId = document.querySelector('#training-mailbox').value;
  try {
    const result = await window.dt.aiMailboxRead({ peerId, direction: 'inbound' });
    const reply = result.messages.filter(item => item.payload?.kind === 'training-reply').at(-1);
    if (reply) {
      document.querySelector('#training-reply').value = reply.payload.reply || '';
      if (trainingDraft) trainingDraft.provider = peerId;
      document.querySelector('#training-save').disabled = !document.querySelector('#training-reply').value.trim();
      document.querySelector('#training-state').textContent = 'MAILBOX REPLY RECEIVED · REVIEW BEFORE SAVING';
    } else {
      document.querySelector('#training-state').textContent = 'NO TRAINING REPLY YET';
    }
    refreshTrainingMailbox();
  } catch (error) {
    document.querySelector('#training-state').textContent = 'MAILBOX POLL FAILED';
  }
});
refreshTrainingMailbox().catch(() => {});

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
let grokCommandTimer = null;
let grokCommandBusy = false;
let peerChatTimer = null;

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
  document.querySelector('#grok-command-channel').disabled = !recording;
  document.querySelector('#peer-chat-poll').disabled = !recording;
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
    clearInterval(grokCommandTimer); grokCommandTimer = null; grokCommandBusy = false;
    clearInterval(peerChatTimer); peerChatTimer = null;
    document.querySelector('#grok-command-channel').textContent='Enable Grok command channel';
    document.querySelector('#grok-command-state').textContent='COMMAND CHANNEL OFF';
    const executeButton=document.querySelector('#control-execute');
    executeButton.disabled = true; executeButton.classList.remove('armed'); executeButton.textContent='STEP 6 — EXECUTE ONCE';
    document.querySelector('#control-abandon').hidden=true;
    document.querySelector('#control-state').textContent = 'NO ACTION QUEUED';
    captureChunkQueue = Promise.resolve(); captureFinalizing = false;
  }
}

async function beginCapture({ automatic = false } = {}) {
  if (captureSession || captureRecorder?.state === 'recording') return false;
  const taskInput = document.querySelector('#capture-task');
  if (automatic && !taskInput.value.trim()) taskInput.value = 'DT DESKTOP GOVERNED SESSION';
  const task = taskInput.value.trim();
  if (!task) { setCaptureUI(false, 'TASK DESCRIPTION REQUIRED'); return false; }
  try {
    const sourceSelect=document.querySelector('#capture-source');
    if (automatic) {
      const screenOption=[...sourceSelect.options].find(option=>String(option.value).startsWith('screen:'));
      if(screenOption) sourceSelect.value=screenOption.value;
    }
    const sourceId=sourceSelect.value;
    if(!sourceId) throw new Error('Select a screen or window to capture');
    captureStream = automatic
      ? await navigator.mediaDevices.getDisplayMedia({ audio: false, video: true })
      : await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } }
        });
    captureSession = await window.dt.startCapture({ task, agentId: selected?.id || null, sourceId, automatic });
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
    setCaptureUI(true, automatic ? '● REC · AUTO · TASK BOUND' : '● REC · TASK BOUND');
    document.querySelector('#grok-command-state').textContent = 'COMMAND CHANNEL OFF';
    refreshPeerConnections().catch(()=>{});
    return true;
  } catch (error) {
    captureStream?.getTracks().forEach(track => track.stop());
    captureStream = null; captureSession = null; captureRecorder = null;
    setCaptureUI(false, 'CAPTURE NOT STARTED · ' + (error.name || 'ERROR'));
    document.querySelector('#control-preview').textContent = JSON.stringify({
      captureError: error.message || String(error),
      errorName: error.name || null,
      nextStep: automatic ? 'Automatic capture failed; use Start Capture to retry.' : 'Confirm the Windows screen-picker selection and retry.'
    }, null, 2);
    return false;
  }
}

document.querySelector('#capture-start').addEventListener('click', () => beginCapture());

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


async function pollGrokCommandOnce() {
  const state=document.querySelector('#grok-command-state');
  if(grokCommandBusy||!captureSession||captureRecorder?.state!=='recording')return;
  grokCommandBusy=true;
  try {
    const result=await window.dt.processGrokCommand({captureSessionId:captureSession.sessionId});
    state.textContent=result.status||'COMMAND CHANNEL READY';
  } catch(error) { state.textContent='COMMAND ERROR · '+error.message; }
  finally { grokCommandBusy=false; }
}

document.querySelector('#grok-command-channel').addEventListener('click', async () => {
  const button=document.querySelector('#grok-command-channel');
  const state=document.querySelector('#grok-command-state');
  if(!captureSession||captureRecorder?.state!=='recording'){state.textContent='ACTIVE CAPTURE REQUIRED';return;}
  if(grokCommandTimer){clearInterval(grokCommandTimer);grokCommandTimer=null;button.textContent='Enable Grok command channel';state.textContent='COMMAND CHANNEL OFF';return;}
  button.textContent='Disable Grok command channel';state.textContent='COMMAND CHANNEL ACTIVE · DT GOVERNED';
  await pollGrokCommandOnce();
  grokCommandTimer=setInterval(pollGrokCommandOnce,2500);
});

function renderPeerChat(messages=[]) {
  const box=document.querySelector('#peer-chat-transcript');
  box.value=messages.map(message => [
    `[${message.createdAt}] ${message.from} → ${message.to}`,
    message.text,
    `# ${message.messageHash}`
  ].join('\n')).join('\n\n');
  box.scrollTop=box.scrollHeight;
}

async function refreshPeerConnections() {
  const section=document.querySelector('#peer-chat');
  try {
    const state=await window.dt.listPeerConnections();
    section.hidden=!state.chatEnabled;
    document.querySelector('#peer-chat-state').textContent=state.chatEnabled?'PEER CHAT ACTIVE':'WAITING FOR 2 PEERS';
    document.querySelector('#peer-chat-peers').textContent=(state.peers||[]).map(peer=>peer.executiveId).join(' ↔ ');
    if(state.chatEnabled){
      const chat=await window.dt.listPeerChat();renderPeerChat(chat.messages||[]);
      if(captureSession&&captureRecorder?.state==='recording'&&!peerChatTimer)peerChatTimer=setInterval(pollPeerChatOnce,3000);
    }
    if((!state.chatEnabled||!captureSession||captureRecorder?.state!=='recording')&&peerChatTimer){clearInterval(peerChatTimer);peerChatTimer=null;}
  } catch(error){document.querySelector('#peer-chat-state').textContent='PEER CHAT ERROR · '+error.message;}
}

async function pollPeerChatOnce() {
  if(!captureSession||captureRecorder?.state!=='recording'||document.querySelector('#peer-chat').hidden)return;
  try {const result=await window.dt.pollPeerChat({captureSessionId:captureSession.sessionId});renderPeerChat(result.messages||[]);}
  catch(error){document.querySelector('#peer-chat-state').textContent='PEER CHAT ERROR · '+error.message;}
}

document.querySelector('#peer-chat-poll').addEventListener('click',pollPeerChatOnce);

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
  else await beginCapture({ automatic: true });
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

boot().then(()=>refreshPeerConnections()).catch(error => { result.textContent = error.stack; });
setInterval(()=>refreshPeerConnections().catch(()=>{}),5000);

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
