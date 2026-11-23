import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parse } from "@terrazzo/parser";
import { selectedPatterns } from "./world-bindings.mjs";
import { resolvedTokens } from "./resolved-tokens.mjs";
import { explainToken, selectedSources } from "./token-explanation.mjs";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      world: { type: "string" },
      mode: { type: "string" },
      output: { type: "string" },
    },
  });
  if (positionals.length !== 1)
    throw new Error(
      "Usage: npm run explain -- <token> [--world <world>] [--mode light|dark] [--output web|frame]",
    );
  const filename = new URL("../resolver.json", import.meta.url);
  const source = JSON.parse(readFileSync(filename, "utf8"));
  const context = Object.fromEntries(
    Object.entries(source.modifiers).map(([name, modifier]) => [
      name,
      values[name] ?? modifier.default,
    ]),
  );
  const { resolver } = await parse({ filename, src: source });
  const tokens = resolvedTokens(resolver.apply(context));
  const sources = selectedSources(
    fileURLToPath(new URL("..", import.meta.url)),
    source,
    context,
  );
  console.log(
    JSON.stringify(
      explainToken(
        positionals[0],
        tokens,
        resolver.apply(context, { resolveAliases: false }),
        selectedPatterns(resolver, context),
        sources,
        context,
      ),
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
