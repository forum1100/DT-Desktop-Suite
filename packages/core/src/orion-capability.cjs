const STOP = new Set(['the','a','an','and','or','to','of','in','on','for','with','how','do','i','me','my','this','that','is','it','can','could','would','should','using','use','able','ability','capability']);

function words(value) {
  return [...new Set(String(value || '').toLowerCase().match(/[a-z0-9_.-]+/g) || [])]
    .filter(word => word.length > 2 && !STOP.has(word));
}

function similarity(query, candidate) {
  const q = words(query), c = new Set(words(candidate));
  if (!q.length) return 0;
  const shared = q.filter(word => c.has(word)).length;
  return shared / q.length;
}

function findMatches(question, tools = [], skills = []) {
  const candidates = [
    ...tools.map(item => ({ kind:'tool', id:item.id, description:item.description || '' })),
    ...skills.map(item => ({ kind:'skill', id:item.id, description:[item.name,item.description].filter(Boolean).join(' ') }))
  ];
  return candidates.map(item => ({ ...item, score:similarity(question, item.id + ' ' + item.description) }))
    .filter(item => item.score > 0).sort((a,b) => b.score - a.score).slice(0,5);
}

module.exports = { words, similarity, findMatches };
