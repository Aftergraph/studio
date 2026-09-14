/**
 * Lightweight trie-based HTTP router (~40 LOC core).
 * Supports static segments and single-level `:param` wildcards.
 * No dependencies.
 */
export class TrieRouter {
  constructor() {
    this._root = { children: Object.create(null), paramChild: null, handlers: Object.create(null) };
  }

  add(method, pattern, handler) {
    const parts = pattern.split('/').filter(Boolean);
    let node = this._root;
    for (const part of parts) {
      if (part.startsWith(':')) {
        if (!node.paramChild) node.paramChild = { name: part.slice(1), node: { children: Object.create(null), paramChild: null, handlers: Object.create(null) } };
        node = node.paramChild.node;
      } else {
        if (!node.children[part]) node.children[part] = { children: Object.create(null), paramChild: null, handlers: Object.create(null) };
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
      // Param match pushed FIRST so static is popped FIRST (LIFO = static priority)
      if (node.paramChild) {
        let decoded;
        try {
          decoded = decodeURIComponent(segment);
        } catch {
          // Malformed percent encoding — skip this branch
          continue;
        }
        const nextParams = Object.assign(Object.create(null), params);
        nextParams[node.paramChild.name] = decoded;
        stack.push({ node: node.paramChild.node, idx: idx + 1, params: nextParams });
      }
      // Static match pushed LAST so it's popped FIRST (higher priority)
      if (node.children[segment]) {
        stack.push({ node: node.children[segment], idx: idx + 1, params });
      }
    }
    return null;
  }
}
