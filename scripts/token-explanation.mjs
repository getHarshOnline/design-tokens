import { readFileSync } from "node:fs";
import { join } from "node:path";

// Keep authored layers, including metadata-only and partial-value overrides.
// Terrazzo supplies the merged values and metadata; this walk only locates them.
export function selectedSources(root, resolver, context) {
  const nodes = new Map();
  let order = 0;
  function walk(node, path, file) {
    const properties = Object.fromEntries(
      Object.entries(node).filter(([key]) => key.startsWith("$")),
    );
    if (Object.keys(properties).length) {
      const layers = nodes.get(path) ?? [];
      layers.push({ file, properties, order: order++ });
      nodes.set(path, layers);
    }
    for (const [key, child] of Object.entries(node))
      if (!key.startsWith("$") && child && typeof child === "object")
        walk(child, path ? path + "." + key : key, file);
  }
  for (const step of resolver.resolutionOrder) {
    const [kind, name] = step.$ref.slice(2).split("/");
    const owner = resolver[kind][name];
    const refs =
      kind === "sets"
        ? owner.sources
        : owner.contexts[context[name] ?? owner.default];
    if (!refs) throw new Error(`Missing token context: ${name}`);
    for (const { $ref: file } of refs)
      walk(JSON.parse(readFileSync(join(root, file), "utf8")), "", file);
  }
  return nodes;
}

export function explainToken(
  id,
  tokens,
  authoredTokens,
  patterns,
  sources,
  context,
) {
  const token = tokens[id],
    pattern = patterns.get(id);
  if (!token && pattern === undefined)
    throw new Error(`No token or pattern named ${id} in the selected context`);
  const chain = [],
    seen = new Set();
  function references(value) {
    if (typeof value === "string") {
      const alias = /^\{([^{}]+)\}$/.exec(value);
      if (alias) visit(alias[1]);
    } else if (Array.isArray(value)) value.forEach(references);
    else if (value && typeof value === "object")
      Object.values(value).forEach(references);
  }
  function layers(name, kind) {
    const parts = name.split("."),
      contributions = [];
    for (let depth = 0; depth <= parts.length; depth++) {
      const path = parts.slice(0, depth).join("."),
        inherited = depth < parts.length;
      for (const source of sources.get(path) ?? []) {
        // Descriptions describe their own group or token; type and extension
        // metadata can qualify descendants and need their source location too.
        const properties = inherited
          ? Object.fromEntries(
              Object.entries(source.properties).filter(
                ([key]) => key === "$type" || key === "$extensions",
              ),
            )
          : source.properties;
        if (!Object.keys(properties).length) continue;
        contributions.push({
          order: source.order,
          item: {
            [kind]: name,
            file: source.file,
            ...(inherited ? { group: path } : {}),
            ...("$value" in properties ? { value: properties.$value } : {}),
            ...("$description" in properties
              ? { description: properties.$description }
              : {}),
            ...("$type" in properties ? { type: properties.$type } : {}),
            ...("$extensions" in properties
              ? { extensions: properties.$extensions }
              : {}),
          },
        });
      }
    }
    if (!contributions.length) throw new Error(`Missing source for ${name}`);
    contributions.sort((a, b) => a.order - b.order);
    chain.push(...contributions.map(({ item }) => item));
  }
  function visit(name) {
    if (seen.has(name)) return;
    seen.add(name);
    if (!authoredTokens[name])
      throw new Error(`Missing selected token ${name}`);
    layers(name, "token");
    // Follow only the effective authored value. An overwritten alias does not
    // contribute to the selected value; a partial composite keeps its siblings.
    references(authoredTokens[name].$value);
  }
  if (token) visit(id);
  else layers(id, "pattern");
  return {
    token: id,
    context,
    ...(token
      ? {
          type: token.$type,
          value: token.$value,
          ...(token.$description !== undefined
            ? { description: token.$description }
            : {}),
          ...(token.$extensions?.["design-tokens.unit"]
            ? { unit: token.$extensions["design-tokens.unit"] }
            : {}),
        }
      : {}),
    ...(pattern !== undefined ? { pattern } : {}),
    sources: chain,
  };
}
