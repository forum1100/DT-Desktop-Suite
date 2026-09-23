const { loadPerceptionContext } = require('./perception-context.cjs');

class DTLocalIntelligence {
  constructor(options = {}) {
    const explicitUrl = options.baseUrl || process.env.DT_LOCAL_MODEL_URL;
    const explicitModel = options.model || process.env.DT_LOCAL_MODEL_ID;
    this.candidates = explicitUrl
      ? [{ baseUrl: String(explicitUrl).replace(/\/$/, ''), model: String(explicitModel || 'dt-home') }]
      : [
          { baseUrl: 'http://127.0.0.1:11741/v1', model: String(explicitModel || 'dt-home') },
          { baseUrl: 'http://127.0.0.1:11434/v1', model: String(process.env.DT_OLLAMA_LOCAL_MODEL || explicitModel || 'llama3.2') }
        ];
    this.baseUrl = this.candidates[0].baseUrl;
    this.model = this.candidates[0].model;
  }

  async status(fetchImpl = fetch) {
    const failures = [];
    for (const candidate of this.candidates) {
      try {
        const response = await fetchImpl(candidate.baseUrl + '/models', { signal: AbortSignal.timeout(1800) });
        if (!response.ok) { failures.push({ ...candidate, httpStatus: response.status }); continue; }
        let data = null;
        try { data = await response.json(); } catch {}
        const ids = Array.isArray(data?.data) ? data.data.map(row => String(row.id || row.model || '')) : [];
        if (ids.length && !ids.some(id => id === candidate.model || id.startsWith(candidate.model + ':'))) {
          failures.push({ ...candidate, error: 'MODEL_NOT_PRESENT', models: ids.slice(0, 20) });
          continue;
        }
        this.baseUrl = candidate.baseUrl; this.model = candidate.model;
        return { available: true, baseUrl: this.baseUrl, model: this.model, httpStatus: response.status, models: ids };
      } catch (error) { failures.push({ ...candidate, error: String(error.message || error) }); }
    }
    return { available: false, baseUrl: this.baseUrl, model: this.model, candidates: failures };
  }

  async complete({ system, prompt }, fetchImpl = fetch) {
    const status = await this.status(fetchImpl);
    if (!status.available) throw new Error('DT local model host is unavailable');
    const perceptionContext = loadPerceptionContext();
    const enrichedSystem = [system, 'DT CURRENT PERCEPTION CONTEXT:', JSON.stringify(perceptionContext)].filter(Boolean).join('\n');
    const response = await fetchImpl(this.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, temperature: 0, messages: [
        { role: 'system', content: enrichedSystem }, { role: 'user', content: prompt }
      ] }),
      signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) throw new Error('DT local model request failed: ' + response.status);
    const data = await response.json();
    return String(data.choices?.[0]?.message?.content || '').trim();
  }
}

module.exports = { DTLocalIntelligence };
