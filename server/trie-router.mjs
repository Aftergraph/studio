/**
 * Lightweight trie-based HTTP router (~40 LOC core).
 * Supports static segments and single-level `:param` wildcards.
 * No dependencies.
 */
export class TrieRouter {
  constructor() {
    this._root = { children: {}, paramChild: null, handlers: {} };
  }

  add(method, pattern, handler) {
    const parts = pattern.split('/').filter(Boolean);
    let node = this._root;
    for (const part of parts) {
      if (part.startsWith(':')) {
        if (!node.paramChild) node.paramChild = { name: part.slice(1), node: { children: {}, paramChild: null, handlers: {} } };
        node = node.paramChild.node;
      } else {
        if (!node.children[part]) node.children[part] = { children: {}, paramChild: null, handlers: {} };
        node = node.children[part];
      }
    }
    node.handlers[method] = handler;
  }

  find(method, pathname) {
    const parts = pathname.split('/').filter(Boolean);
    const stack = [{ node: this._root, idx: 0, params: {} }];
    while (stack.length) {
      const { node, idx, params } = stack.pop();
      if (idx === parts.length) {
        if (node.handlers[method]) return { handler: node.handlers[method], params };
        continue;
      }
      const segment = parts[idx];
      // Static match first (higher priority)
      if (node.children[segment]) {
        stack.push({ node: node.children[segment], idx: idx + 1, params });
      }
      // Param match
      if (node.paramChild) {
        const nextParams = Object.assign(Object.create(null), params);
        nextParams[node.paramChild.name] = decodeURIComponent(segment);
        stack.push({ node: node.paramChild.node, idx: idx + 1, params: nextParams });
      }
    }
    return null;
  }
}
