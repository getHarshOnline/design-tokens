import { resolvedTokens } from "./resolved-tokens.mjs";

// Queries need literal dimensions. Resolve them in the same web context as the
// stylesheets, including aliases that cross token files.
export default function layoutLiterals() {
  return {
    name: "layout-literals",
    build({ resolver, outputFile }) {
      const tokens = resolvedTokens(resolver.apply({ output: "web" }));
      const lines = [];
      for (const [id, token] of Object.entries(tokens)) {
        if (!id.startsWith("layout.") || token.$type !== "dimension") continue;
        const { value, unit } = token.$value ?? {};
        if (!Number.isFinite(value) || !["px", "rem"].includes(unit)) {
          throw new Error(`${id}: a literal layout dimension is required`);
        }
        lines.push(`$${id.replaceAll(".", "-")}: ${value}${unit};`);
      }
      outputFile("scss/_layout.scss", `${lines.join("\n")}\n`);
    },
  };
}
