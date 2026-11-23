import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "@terrazzo/parser";
import { resolvedTokens } from "./resolved-tokens.mjs";
import { selectedPatterns } from "./world-bindings.mjs";
import { explainToken, selectedSources } from "./token-explanation.mjs";

const cli = fileURLToPath(new URL("./explain.mjs", import.meta.url));
const run = (...args) =>
  JSON.parse(
    execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" }),
  );
const read = (path) =>
  JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));

test("explanation follows the selected world and mode through the complete alias chain", () => {
  for (const mode of ["light", "dark"]) {
    const result = run(
      "world.illumination.key",
      "--world",
      "lattice",
      "--mode",
      mode,
      "--output",
      "frame",
    );
    assert.deepEqual(result.context, {
      world: "lattice",
      mode,
      output: "frame",
    });
    assert.deepEqual(
      result.sources
        .filter((item) => "value" in item)
        .map((item) => item.token),
      ["world.illumination.key", "color.key", `world.${mode}.key`],
    );
    assert.equal(
      result.sources.find(
        (item) => item.token === "world.illumination.key" && "value" in item,
      ).file,
      "tokens/worlds/lattice.tokens.json",
    );
    assert.equal(
      result.sources.find(
        (item) => item.token === "color.key" && "value" in item,
      ).file,
      `tokens/modes/${mode}.tokens.json`,
    );
    assert.deepEqual(
      result.value,
      read("tokens/worlds/lattice.tokens.json").world[mode].key.$value,
    );
    assert.equal(
      result.sources[0].description,
      read("tokens/world.roles.json").world.illumination.key.$description,
    );
  }
});

test("build metadata and output-specific roles have explicit source explanations", () => {
  const mode = run("world.mode.default", "--world", "nocturne");
  assert.equal(mode.pattern, "dark");
  assert.equal(
    mode.sources.find(
      (item) => item.extensions?.["design-tokens.pattern"] === "dark",
    ).file,
    "tokens/worlds/nocturne.tokens.json",
  );
  const emission = run(
    "world.illumination.emission",
    "--world",
    "carrier",
    "--mode",
    "dark",
  );
  assert.equal(
    emission.description,
    "Warm amber against the cool optical interior.",
  );
  assert.equal(emission.sources[0].file, "tokens/world.roles.json");
  assert.match(
    emission.sources[0].description,
    /emission and held state are one hue/,
  );
  assert.ok(
    emission.sources.some(
      (item) =>
        item.file === "tokens/worlds/carrier.tokens.json" &&
        item.description === emission.description,
    ),
  );
  const frame = run(
    "frame.duration.transition",
    "--world",
    "carrier",
    "--mode",
    "dark",
    "--output",
    "frame",
  );
  assert.equal(frame.type, "duration");
  assert.equal(frame.sources[0].file, "tokens/outputs/frame.tokens.json");
  assert.deepEqual(
    frame.value,
    read("tokens/outputs/frame.tokens.json").frame.duration.transition.$value,
  );
});

test("unknown names and contexts fail instead of explaining a different selection", () => {
  for (const args of [
    [],
    ["missing.token"],
    ["color.paper", "--world", "missing"],
    ["color.paper", "--mode", "missing"],
    ["frame.duration.transition", "--output", "web"],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0, args.join(" "));
    assert.ok(result.stderr.trim(), args.join(" "));
  }
});

test("partial overrides explain merged descriptions, inherited metadata and composite contributions", async () => {
  const root = mkdtempSync(join(tmpdir(), "token-explanation-"));
  try {
    const base = {
      group: {
        $type: "number",
        test: {
          $value: 1,
          $description: "base description",
          $extensions: { "design-tokens.unit": "deg" },
        },
      },
      color: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [0, 0, 0] },
      },
      border: {
        $type: "border",
        $value: {
          color: "{color}",
          width: { value: 1, unit: "px" },
          style: "solid",
        },
      },
      fonts: { $type: "fontFamily", $value: ["Old", "Fallback"] },
      pattern: {
        $description: "base pattern",
        $extensions: { "design-tokens.pattern": "below" },
      },
    };
    const override = {
      group: { test: { $description: "selected description" } },
      border: { $value: { width: { value: 2 } } },
      fonts: { $value: ["New"] },
      pattern: { $description: "selected pattern" },
    };
    const config = {
      version: "2025.10",
      sets: { base: { sources: [{ $ref: "base.json" }] } },
      modifiers: {
        mode: {
          contexts: { light: [{ $ref: "override.json" }], dark: [] },
          default: "light",
        },
      },
      resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/mode" }],
    };
    for (const [file, value] of Object.entries({
      "base.json": base,
      "override.json": override,
      "resolver.json": config,
    }))
      writeFileSync(join(root, file), JSON.stringify(value));
    const { resolver } = await parse({
      filename: pathToFileURL(join(root, "resolver.json")),
      src: config,
    });
    const context = { mode: "light" },
      tokens = resolvedTokens(resolver.apply(context));
    const explain = (id) =>
      explainToken(
        id,
        tokens,
        resolver.apply(context, { resolveAliases: false }),
        selectedPatterns(resolver, context),
        selectedSources(root, config, context),
        context,
      );
    const number = explain("group.test");
    assert.equal(number.value, 1);
    assert.equal(number.type, "number");
    assert.equal(number.unit, "deg");
    assert.equal(number.description, "selected description");
    assert.deepEqual(
      number.sources.map((item) => [item.file, item.group, item.description]),
      [
        ["base.json", "group", undefined],
        ["base.json", undefined, "base description"],
        ["override.json", undefined, "selected description"],
      ],
    );
    const border = explain("border");
    assert.deepEqual(border.value.width, { value: 2, unit: "px" });
    assert.equal(border.value.style, "solid");
    assert.deepEqual(
      border.sources.map((item) => [item.token, item.file]),
      [
        ["border", "base.json"],
        ["border", "override.json"],
        ["color", "base.json"],
      ],
    );
    assert.deepEqual(border.sources[1].value, { width: { value: 2 } });
    assert.deepEqual(explain("fonts").value, ["New"]);
    const pattern = explain("pattern");
    assert.equal(pattern.pattern, "below");
    assert.deepEqual(
      pattern.sources.map((item) => item.description),
      ["base pattern", "selected pattern"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
