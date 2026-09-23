const API = 'http://127.0.0.1:43120';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'dt-local-api') return;
  const path = String(message.path || '');
  const options = message.options || {};
  fetch(API + path, {
    ...options,
    headers: {'Content-Type': 'application/json', ...(options.headers || {})}
  })
    .then(async response => {
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : {}; } catch { data = {raw: text}; }
      if (!response.ok) throw new Error(`DT local API ${response.status}: ${text}`);
      sendResponse({ok: true, data});
    })
    .catch(error => sendResponse({ok: false, error: String(error.message || error)}));
  return true;
});