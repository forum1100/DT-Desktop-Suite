class DTLocalIntelligence {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || process.env.DT_LOCAL_MODEL_URL || 'http://127.0.0.1:11741/v1').replace(/\/$/, '');
    this.model = String(options.model || process.env.DT_LOCAL_MODEL_ID || 'dt-home');
  }

  async status(fetchImpl = fetch) {
    try {
      const response = await fetchImpl(this.baseUrl + '/models', { signal: AbortSignal.timeout(1500) });
      return { available: response.ok, baseUrl: this.baseUrl, model: this.model, httpStatus: response.status };
    } catch (error) {
      return { available: false, baseUrl: this.baseUrl, model: this.model, error: String(error.message || error) };
    }
  }

  async complete({ system, prompt }, fetchImpl = fetch) {
    const response = await fetchImpl(this.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, temperature: 0, messages: [
        { role: 'system', content: system }, { role: 'user', content: prompt }
      ] }),
      signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) throw new Error('DT local model request failed: ' + response.status);
    const data = await response.json();
    return String(data.choices?.[0]?.message?.content || '').trim();
  }
}

module.exports = { DTLocalIntelligence };
