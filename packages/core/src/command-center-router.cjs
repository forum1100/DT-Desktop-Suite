const OWNER_COMMANDS = new Set([
  'girls im home',
  'connect me'
]);

function normalize(value) {
  return String(value || '').trim();
}

function classifyCommandCenterInput(value) {
  const text = normalize(value);
  if (!text) return { route: 'EMPTY', payload: '' };
  const lower = text.toLowerCase();

  if (OWNER_COMMANDS.has(lower)) {
    return { route: 'SHELL', payload: text, reason: 'OWNER_COMMAND_ALIAS' };
  }
  if (lower.startsWith('/shell ')) {
    return { route: 'SHELL', payload: text.slice(7).trim(), reason: 'EXPLICIT_SHELL_PREFIX' };
  }
  if (text.startsWith('$ ')) {
    return { route: 'SHELL', payload: text.slice(2).trim(), reason: 'EXPLICIT_DOLLAR_PREFIX' };
  }
  if (lower.startsWith('run ')) {
    return { route: 'SHELL', payload: text.slice(4).trim(), reason: 'EXPLICIT_RUN_PREFIX' };
  }
  if (lower.startsWith('/ask ')) {
    return { route: 'PROMPT', payload: text.slice(5).trim(), reason: 'EXPLICIT_PROMPT_PREFIX' };
  }
  if (lower.startsWith('ask:')) {
    return { route: 'PROMPT', payload: text.slice(4).trim(), reason: 'EXPLICIT_PROMPT_PREFIX' };
  }

  return {
    route: 'PROMPT',
    payload: text,
    reason: 'NATURAL_LANGUAGE_DEFAULT'
  };
}

module.exports = {
  OWNER_COMMANDS,
  classifyCommandCenterInput
};
