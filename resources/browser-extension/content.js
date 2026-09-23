(() => {
  'use strict';
  const API = 'http://127.0.0.1:43120';
  const host = location.hostname.toLowerCase();
  const provider = host === 'chatgpt.com' ? 'chatgpt' : host === 'grok.com' ? 'grok' : 'gemini';
  let activeJobId = null;
  let submitted = false;
  let lastSnapshotText = '';

  async function api(path, options = {}) {
    const reply = await chrome.runtime.sendMessage({type: 'dt-local-api', path, options});
    if (!reply?.ok) throw new Error(reply?.error || 'DT local API bridge failed');
    return reply.data;
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function visible(el) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none';
  }

  function safeExpandable(el) {
    const text = `${el.innerText || ''} ${el.getAttribute('aria-label') || ''}`.trim();
    return /(show|more|expand|continue|see more|details|context|sources|thinking|reasoning)/i.test(text) &&
      !/(delete|remove|logout|sign out|account|settings|share|report)/i.test(text);
  }
  async function expandReadableContext() {
    const restored = [];
    for (const detail of document.querySelectorAll('details:not([open])')) {
      if (!visible(detail)) continue;
      detail.open = true; restored.push(() => { detail.open = false; });
    }
    const controls = [...document.querySelectorAll('[aria-expanded="false"]')]
      .filter(el => visible(el) && safeExpandable(el)).slice(0, 60);
    for (const el of controls) {
      try { el.click(); restored.push(() => { try { if (el.getAttribute('aria-expanded') === 'true') el.click(); } catch {} }); }
      catch {}
      await sleep(80);
    }
    return () => { for (const restore of restored.reverse()) { try { restore(); } catch {} } };
  }

  function scrollTarget() {
    const nodes = [document.scrollingElement, ...document.querySelectorAll('main, [role="main"], div')]
      .filter(Boolean).filter(el => el.scrollHeight > el.clientHeight + 300);
    nodes.sort((a, b) => (b.scrollHeight * Math.max(1, b.clientWidth)) - (a.scrollHeight * Math.max(1, a.clientWidth)));
    return nodes[0] || document.scrollingElement;
  }

  function normalizedLines(text) {
    return String(text || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
  }
  async function captureReadablePage(job, phase) {
    const restore = await expandReadableContext();
    const target = scrollTarget();
    const originalTop = target ? target.scrollTop : 0;
    const segments = [];
    const seen = new Set();
    try {
      const max = Math.max(0, (target?.scrollHeight || document.body.scrollHeight) - (target?.clientHeight || innerHeight));
      const step = Math.max(500, Math.floor((target?.clientHeight || innerHeight) * 0.75));
      for (let y = 0; y <= max; y += step) {
        if (target) target.scrollTop = y; else scrollTo(0, y);
        await sleep(120);
        const lines = normalizedLines(document.body.innerText);
        const fresh = lines.filter(line => !seen.has(line) && seen.add(line));
        segments.push({scrollTop: y, text: fresh.join('\n')});
      }
      if (target) target.scrollTop = max; else scrollTo(0, max);
      await sleep(100);
      const combinedText = segments.map(x => x.text).filter(Boolean).join('\n');
      return {
        job_id: job.job_id, provider, phase, page_url: location.href, title: document.title,
        viewport: {width: innerWidth, height: innerHeight, devicePixelRatio},
        document: {scrollHeight: target?.scrollHeight || document.body.scrollHeight},
        segments, combined_text: combinedText,
        expandable_context_attempted: true
      };
    } finally {
      if (target) target.scrollTop = originalTop;
      restore();
    }
  }
  function composerCandidates() {
    return [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')]
      .filter(visible).map(el => ({el, rect: el.getBoundingClientRect()}))
      .sort((a, b) => (b.rect.bottom + b.rect.width) - (a.rect.bottom + a.rect.width));
  }

  function setComposer(el, text) {
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, text);
      el.dispatchEvent(new Event('input', {bubbles: true}));
      el.dispatchEvent(new Event('change', {bubbles: true}));
      return;
    }
    el.textContent = '';
    document.execCommand('insertText', false, text);
    el.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: text}));
  }

  function findSendButton() {
    const buttons = [...document.querySelectorAll('button, [role="button"]')].filter(visible);
    const labelled = buttons.find(el => /^(send|submit|ask|run)$/i.test((el.getAttribute('aria-label') || el.innerText || '').trim()));
    if (labelled) return labelled;
    return buttons.find(el => /send|submit/i.test(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-testid') || ''}`));
  }
  async function submitJob(job) {
    const candidate = composerCandidates()[0]?.el;
    if (!candidate) throw new Error('No visible AI composer found');
    setComposer(candidate, job.prompt);
    await sleep(250);
    const send = findSendButton();
    if (send && !send.disabled) send.click();
    else candidate.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', bubbles: true}));
    await api('/v1/browser/closeout/submitted', {method: 'POST', body: JSON.stringify({job_id: job.job_id, page_url: location.href})});
    submitted = true;
  }

  async function snapshot(job, phase) {
    const snap = await captureReadablePage(job, phase);
    if (phase !== 'final' && snap.combined_text === lastSnapshotText) return;
    lastSnapshotText = snap.combined_text;
    await api('/v1/browser/closeout/snapshot', {method: 'POST', body: JSON.stringify(snap)});
  }

  async function work() {
    try {
      const state = await api('/v1/browser/closeout/current?page_url=' + encodeURIComponent(location.href));
      const job = state.current_job;
      if (!job || job.provider !== provider) return;
      if (activeJobId !== job.job_id) { activeJobId = job.job_id; submitted = false; lastSnapshotText = ''; }
      if (!submitted && !['submitted', 'observing', 'complete'].includes(job.status)) {
        await snapshot(job, 'pre-submit');
        await submitJob(job);
      }
      if (document.body.innerText.includes(job.sentinel)) {
        await snapshot(job, 'final');
        await api('/v1/browser/closeout/complete', {method: 'POST', body: JSON.stringify({job_id: job.job_id, page_url: location.href})});
        activeJobId = null; submitted = false; return;
      }
      await snapshot(job, 'observing');
    } catch (error) {
      console.debug('[DT Browser Perception Bridge]', error.message || error);
    }
  }

  setTimeout(work, 1500);
  setInterval(work, 12000);
})();
