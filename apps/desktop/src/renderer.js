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
  output.textContent = 'Contacting selected provider…';
  try {
    const response = await window.dt.askProvider({
      provider: document.querySelector('#provider').value,
      model: document.querySelector('#model').value.trim(),
      baseUrl: document.querySelector('#base-url').value.trim(),
      prompt: document.querySelector('#ai-prompt').value,
      agentId: selected?.id || null,
      input: currentInput()
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
