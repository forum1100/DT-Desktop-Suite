let selected = null;
const nav = document.querySelector('#agents');
const panel = document.querySelector('#agent-panel');
const empty = document.querySelector('#empty');
const form = document.querySelector('#agent-form');
const result = document.querySelector('#result');

function choose(agent) {
  selected = agent;
  empty.hidden = true; panel.hidden = false;
  document.documentElement.style.setProperty('--agent', agent.color);
  document.querySelector('#agent-name').textContent = agent.name;
  document.querySelector('#agent-purpose').textContent = agent.purpose;
  document.querySelector('#agent-status').textContent = agent.status;
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
