import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compareWorlds, matrixMarkdown } from "./world-matrix.mjs";

const read = (path) =>
  JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));

test("the generated joint view includes every named world on nine axes in all four states", () => {
  const matrix = read("dist/worlds.json");
  const worlds = Object.keys(
    read("resolver.json").modifiers.world.contexts,
  ).filter((name) => name !== "neutral");
  assert.equal(matrix.format, "design-tokens.world-matrix.v1");
  assert.deepEqual(matrix.worlds, worlds);
  assert.deepEqual(
    matrix.axes.map((axis) => axis.name),
    [
      "Material character",
      "Raster and texture",
      "Geometry",
      "Display inflection",
      "Figure rhythm",
      "Emission hue and spectral light",
      "Crop behaviour",
      "Optical depth",
      "Expressive motion curve",
    ],
  );
  assert.deepEqual(
    matrix.states.map(({ mode, motion }) => [mode, motion]),
    [
      ["light", "full"],
      ["light", "reduced"],
      ["dark", "full"],
      ["dark", "reduced"],
    ],
  );
  for (const state of matrix.states)
    for (const world of worlds) {
      const position = state.worlds[world];
      assert.deepEqual(
        Object.keys(position),
        matrix.axes.map((axis) => axis.id),
      );
      for (const axis of Object.values(position)) {
        assert.ok(Object.keys(axis.tokens).length);
        for (const item of Object.values(axis.tokens))
          assert.ok(item.type && item.value !== undefined);
      }
      const source = read(`tokens/worlds/${world}.tokens.json`).world;
      assert.deepEqual(position.material.tokens["color.paper"].value, {
        alpha: 1,
        ...source[state.mode].paper.$value,
      });
      assert.equal(
        position.raster.patterns["world.material.raster"],
        source.material.raster.$extensions["design-tokens.pattern"],
      );
      const reduced = state.motion === "reduced";
      const prefix = reduced ? "world.motion.reduced" : "world.motion";
      const motion = reduced ? source.motion.reduced : source.motion;
      assert.equal(
        position.motion.tokens[prefix + ".expressive-scale"].value,
        motion["expressive-scale"].$value,
      );
      assert.equal(
        position.motion.tokens["world.motion.expressive-spring.bounce"] !==
          undefined,
        !reduced,
      );
      assert.deepEqual(
        position.emission.tokens[prefix + ".decay"],
        position.motion.tokens[prefix + ".decay"],
      );
    }
  assert.equal(
    readFileSync(new URL("../dist/worlds.md", import.meta.url), "utf8"),
    matrixMarkdown(matrix),
  );
});

test("the generated positions retain non-colour differences in every state", () => {
  const matrix = read("dist/worlds.json");
  const pairs = compareWorlds(matrix);
  assert.equal(
    pairs.length,
    (4 * matrix.worlds.length * (matrix.worlds.length - 1)) / 2,
  );
  assert.deepEqual(
    pairs.filter((pair) => !pair.differingAxes.length),
    [],
  );
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./check-worlds.mjs", import.meta.url))],
    { stdio: "pipe" },
  );
});

test("palette changes and full-motion-only changes cannot hide identical reduced positions", () => {
  const matrix = read("dist/worlds.json");
  const [left, right] = matrix.worlds;
  matrix.worlds = [left, right];
  for (const state of matrix.states) {
    state.worlds[right] = structuredClone(state.worlds[left]);
    for (const axis of Object.values(state.worlds[right]))
      for (const token of Object.values(axis.tokens)) {
        if (token.type === "color")
          token.value = {
            colorSpace: "srgb",
            components: [0.123, 0.234, 0.345],
          };
      }
  }
  assert.equal(
    compareWorlds(matrix).filter((pair) => !pair.differingAxes.length).length,
    4,
  );
  for (const state of matrix.states)
    if (state.motion === "full") {
      state.worlds[right].motion.tokens[
        "world.motion.expressive-spring.bounce"
      ].value = 0.9;
    }
  const identical = compareWorlds(matrix).filter(
    (pair) => !pair.differingAxes.length,
  );
  assert.deepEqual(
    identical.map((pair) => [pair.mode, pair.motion]),
    [
      ["light", "reduced"],
      ["dark", "reduced"],
    ],
  );
});

test("the readable view escapes authored strings without changing its data", () => {
  const matrix = read("dist/worlds.json");
  const token =
    matrix.states[0].worlds[matrix.worlds[0]].type.tokens[
      "world.type.display.family"
    ];
  token.value = ["<script>|unexpected</script>"];
  const markdown = matrixMarkdown(matrix);
  assert.ok(markdown.includes("&lt;script&gt;&#124;unexpected&lt;/script&gt;"));
  assert.ok(!markdown.includes("<script>"));
  assert.deepEqual(token.value, ["<script>|unexpected</script>"]);
});

test("object key order does not turn equivalent dimensions or composites into different positions", () => {
  const matrix = read("dist/worlds.json");
  const [left, right] = matrix.worlds;
  matrix.worlds = [left, right];
  function reorder(value) {
    if (Array.isArray(value)) return value.map(reorder);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([key, item]) => [key, reorder(item)]),
      );
    return value;
  }
  for (const state of matrix.states)
    state.worlds[right] = reorder(structuredClone(state.worlds[left]));
  assert.equal(
    compareWorlds(matrix).filter((pair) => !pair.differingAxes.length).length,
    4,
  );
  for (const state of matrix.states)
    state.worlds[right].type.tokens["world.type.display.family"].value = [
      "First",
      "Second",
    ];
  for (const state of matrix.states)
    state.worlds[left].type.tokens["world.type.display.family"].value = [
      "Second",
      "First",
    ];
  assert.ok(
    compareWorlds(matrix).every((pair) => pair.differingAxes.includes("type")),
  );
});
