export function canFinanciallyMutate({ online, cached } = {}) {
  return online === true && cached !== true;
}

export function itemsForBillingView(items = [], view = 'inbox') {
  if (view !== 'inbox') return items.filter((item) => item.status === view);
  const rank = { needs_info: 0, ready: 1, waiting: 2 };
  return items
    .filter((item) => Object.hasOwn(rank, item.status))
    .toSorted((a, b) => rank[a.status] - rank[b.status]);
}
