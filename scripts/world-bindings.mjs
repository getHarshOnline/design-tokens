import { resolvedTokens } from "./resolved-tokens.mjs";

// The resolver's selected groups retain pattern metadata that is not a token
// value. Read those groups once; numeric and colour values use resolver.apply.
function collectPatterns(groups) {
  const patterns = new Map();
  function walk(node, path = []) {
    if (!node || typeof node !== "object") return;
    const pattern = node.$extensions?.["design-tokens.pattern"];
    if (pattern !== undefined) patterns.set(path.join("."), pattern);
    for (const [key, child] of Object.entries(node)) {
      if (!key.startsWith("$")) walk(child, [...path, key]);
    }
  }
  for (const group of groups) walk(group);
  return patterns;
}

export function worldPatterns(resolver, world) {
  return collectPatterns(resolver.source.modifiers.world.contexts[world]);
}

// Metadata follows the entire selected context, including mode and output
// overrides, in the same order as resolved token values.
export function selectedGroups(resolver, context) {
  return resolver.source.resolutionOrder.flatMap((step) => {
    if (step.type === "set") return step.sources;
    const groups = step.contexts[context[step.name] ?? step.default];
    if (!groups) throw new Error(`Missing token context: ${step.name}`);
    return groups;
  });
}

export function selectedPatterns(resolver, context) {
  return collectPatterns(selectedGroups(resolver, context));
}

export default function worldBindings() {
  return {
    name: "world-bindings",
    build({ resolver }) {
      const ids = (world) =>
        Object.keys(
          resolvedTokens(
            resolver.apply({ world, mode: "light", output: "web" }),
          ),
        )
          .filter((id) => id.startsWith("world."))
          .sort();
      const expected = ids("neutral");
      const patterns = [...worldPatterns(resolver, "neutral").keys()].sort();
      const descriptions = new Set();
      function readDefinitions(node, path = []) {
        if (!node || typeof node !== "object") return;
        if ("$value" in node)
          throw new Error(
            "Shared world-role definitions must not supply values",
          );
        if (typeof node.$description === "string" && node.$description.trim())
          descriptions.add(path.join("."));
        for (const [name, child] of Object.entries(node)) {
          if (!name.startsWith("$")) readDefinitions(child, [...path, name]);
        }
      }
      for (const source of resolver.source.sets["world-roles"].sources)
        readDefinitions(source);
      const undescribed = [...new Set([...expected, ...patterns])].filter(
        (id) => !descriptions.has(id),
      );
      if (undescribed.length)
        throw new Error(
          `World roles lack shared meanings: ${undescribed.join(", ")}`,
        );

      for (const world of Object.keys(
        resolver.source.modifiers.world.contexts,
      )) {
        const actual = ids(world);
        const difference = expected
          .filter((id) => !actual.includes(id))
          .concat(actual.filter((id) => !expected.includes(id)));
        if (difference.length)
          throw new Error(
            `${world}: world roles differ from neutral: ${difference.join(", ")}`,
          );
        const actualPatterns = [
          ...worldPatterns(resolver, world).keys(),
        ].sort();
        if (JSON.stringify(actualPatterns) !== JSON.stringify(patterns)) {
          throw new Error(`${world}: pattern roles differ from neutral`);
        }
        const mode = worldPatterns(resolver, world).get("world.mode.default");
        if (!["system", "dark"].includes(mode))
          throw new Error(`${world}: default mode must be system or dark`);
      }
    },
  };
}
