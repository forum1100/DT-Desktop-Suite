const state = { sessions: new Map(), selected: null, output: new Map() };
const list = document.querySelector('#sessions');
const terminal = document.querySelector('#terminal');
const welcome = document.querySelector('#welcome');
const output = document.querySelector('#output');
const dialog = document.querySelector('#create');

function renderList() {
  list.replaceChildren(...[...state.sessions.values()].map(session => {
    const button = document.createElement('button');
    button.className = 'session' + (state.selected === session.id ? ' active' : '');
    button.innerHTML = `<b>${session.name}</b><small>${session.owner} · PID ${session.pid} · ${session.state}</small>`;
    button.addEventListener('click', () => select(session.id));
    return button;
  }));
}

function select(id) {
  state.selected = id;
  const session = state.sessions.get(id);
  welcome.hidden = true; terminal.hidden = false;
  document.querySelector('#title').textContent = session.name;
  document.querySelector('#meta').textContent = `${session.owner} · PID ${session.pid} · ${session.cwd}`;
  output.textContent = state.output.get(id) || '';
  output.scrollTop = output.scrollHeight;
  renderList();
}

async function refresh() {
  for (const session of await window.commandCenter.list()) state.sessions.set(session.id, session);
  renderList();
}

document.querySelector('#new').addEventListener('click', () => dialog.showModal());
document.querySelector('#x').addEventListener('click', () => dialog.close());
document.querySelector('#create-session').addEventListener('click', async () => {
  const error = document.querySelector('#error'); error.textContent = '';
  try {
    const session = await window.commandCenter.create({
      name: document.querySelector('#name').value,
      owner: document.querySelector('#owner').value,
      cwd: document.querySelector('#cwd').value
    });
    state.sessions.set(session.id, session); state.output.set(session.id, '');
    dialog.close(); select(session.id);
  } catch (exception) { error.textContent = exception.message; }
});

document.querySelector('#command').addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.querySelector('#input');
  if (!state.selected || !input.value.trim()) return;
  await window.commandCenter.send(state.selected, input.value);
  input.value = '';
});

document.querySelector('#close').addEventListener('click', async () => {
  if (state.selected) await window.commandCenter.close(state.selected);
});

window.commandCenter.onOutput(data => {
  state.output.set(data.id, (state.output.get(data.id) || '') + data.text);
  if (state.selected === data.id) { output.textContent = state.output.get(data.id); output.scrollTop = output.scrollHeight; }
});
window.commandCenter.onState(session => { state.sessions.set(session.id, session); renderList(); });
refresh();
