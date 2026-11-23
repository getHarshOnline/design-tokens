// Terrazzo 2.7.1 leaves some aliases unresolved, including zero values; resolve those here.
// Terrazzo still chooses the context and checks types; copy its records without changing them.
export function resolvedTokens(tokens) {
  const values = new Map();
  const active = new Set();
  function value(id) {
    if (values.has(id)) return values.get(id);
    if (!tokens[id]) throw new Error(`Missing resolved token: ${id}`);
    if (active.has(id)) throw new Error(`Cyclic resolved token: ${id}`);
    active.add(id);
    const result = walk(tokens[id].$value);
    active.delete(id);
    values.set(id, result);
    return result;
  }
  function walk(item) {
    const alias = typeof item === 'string' && /^\{([^{}]+)\}$/.exec(item);
    if (alias) return value(alias[1]);
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, walk(v)]));
    return item;
  }
  return Object.fromEntries(Object.entries(tokens).map(([id, token]) => [id, { ...token, $value: value(id) }]));
}
