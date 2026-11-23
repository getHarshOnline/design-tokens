import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crossingRules } from "./crossing-marks.mjs";

const read = (path) =>
  JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));

test("each stylesheet carries every declared destination without depending on its glyph font", () => {
  const worlds = Object.keys(read("resolver.json").modifiers.world.contexts);
  for (const host of worlds) {
    const css = readFileSync(
      new URL(
        `../dist/css/${host === "neutral" ? "base" : host}.css`,
        import.meta.url,
      ),
      "utf8",
    );
    for (const destination of worlds.filter((name) => name !== "neutral")) {
      assert.ok(
        css.includes(`data-gazette-destination-theme="theme:${destination}"`),
      );
      assert.ok(
        css.includes(
          `--crossing-target-ink: var(--color-crossing-${destination});`,
        ),
      );
    }
    assert.ok(!css.includes('content: "⌇"'));
  }
});

test("selected mark metadata overrides the shared source and incomplete signatures fail", () => {
  const crossing = read("tokens/physics/crossing.tokens.json").crossing;
  const replacement = structuredClone(
    crossing.carrier.$extensions["design-tokens.mask"],
  );
  replacement.image = "linear-gradient(#000,#000)";
  const resolver = {
    source: {
      modifiers: { world: { contexts: { neutral: [], carrier: [] } } },
      resolutionOrder: [
        { type: "set", sources: [{ crossing }] },
        {
          type: "modifier",
          name: "world",
          default: "neutral",
          contexts: {
            neutral: [],
            carrier: [
              {
                crossing: {
                  carrier: {
                    $extensions: { "design-tokens.mask": replacement },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };
  const tokens = { "color.crossing.carrier": { $type: "color" } };
  const css = crossingRules(resolver, "carrier", tokens);
  assert.ok(
    css.includes(
      "--link-mark-image: linear-gradient(var(--crossing-ink),var(--crossing-ink));",
    ),
  );
  assert.throws(
    () => crossingRules(resolver, "carrier", {}),
    /Incomplete destination mark/,
  );
  replacement.composite = "unsupported";
  assert.throws(
    () => crossingRules(resolver, "carrier", tokens),
    /Incomplete destination mark/,
  );
});
