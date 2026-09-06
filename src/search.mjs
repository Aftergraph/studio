function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(value) { return normalize(value).split(' ').filter(Boolean); }

export function searchIndex(items, query, limit = 20) {
  const q = normalize(query);
  if (!q) return [];
  const qTokens = tokens(q);
  return items.map((item, index) => {
    const id = normalize(item.id);
    const title = normalize(item.title || item.name || '');
    const type = normalize(item.type || item.kind || '');
    const domain = normalize(item.domain || '');
    const hay = `${id} ${title} ${type} ${domain}`;
    const hTokens = new Set(tokens(hay));
    let score = 0;
    if (id === q) score += 120;
    if (id.startsWith(q)) score += 80;
    if (title === q) score += 100;
    if (title.startsWith(q)) score += 60;
    if (hay.includes(q)) score += 35;
    for (const qt of qTokens) {
      if (hTokens.has(qt)) score += 20;
      else if ([...hTokens].some(ht => ht.startsWith(qt) || qt.startsWith(ht))) score += 8;
    }
    return { ...item, _score:score, _index:index };
  }).filter(x => x._score > 0)
    .sort((a,b) => b._score - a._score || a._index - b._index)
    .slice(0, limit)
    .map(({ _score, _index, ...item }) => item);
}
