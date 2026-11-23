import { defineConfig } from "@terrazzo/cli";
import css from "@terrazzo/plugin-css";
import sass from "@terrazzo/plugin-sass";
import { valuesOnly } from "./scripts/styles-output.mjs";
import layoutLiterals from "./scripts/scss-literals.mjs";
import frameOutput from "./scripts/frame-output.mjs";
import { crossingRules } from "./scripts/crossing-marks.mjs";
import worldMatrix from "./scripts/world-matrix.mjs";
import worldBindings, { worldPatterns } from "./scripts/world-bindings.mjs";
import { fontFallbacks, motionBlocks, darkBlocks, printBlock, productiveSpring, bookmarkEasing, filmNavigationEasing, read, variableName, withUnit, worldExtras, withResolvedTokens } from "./scripts/token-css.mjs";

const contexts = read('resolver.json').modifiers.world.contexts;
const worlds = Object.keys(contexts).filter(name => name !== 'neutral');
const extras = (resolver, name, tokens) => worldExtras(worldPatterns(resolver, name), tokens);

// One stylesheet per world: physics, the world's tokens, springs and pattern choices in :root,
// then the dark colour-mode blocks.
const world = (name) =>
  withResolvedTokens((resolve, resolver) => valuesOnly(css({
    filename: `css/${name === 'neutral' ? 'base' : name}.css`,
    variableName,
    transform: withUnit,
    permutations: [
      {
        input: { world: name, mode: "light" },
        prepare: (body) => {
          const tokens = resolve({ world: name, mode: "light", output: "web" });
          return `${fontFallbacks(tokens)}\n:root {\n${body}\n${productiveSpring(tokens)}\n${bookmarkEasing(tokens)}\n${filmNavigationEasing(tokens)}\n${extras(resolver(), name, tokens)}\n}\n${motionBlocks()}\n${crossingRules(resolver(), name, tokens)}`;
        },
      },
      ...darkBlocks({ input: { world: name, mode: "dark" }, include: ["color.**"] }, "",
        () => worldPatterns(resolver(), name).get('world.mode.default') === 'dark'),
      printBlock({ input: { world: name, mode: "light" } }),
    ],
  })));

// Enclaves: every world's colour roles and world.* tokens scoped under [data-world="<world>"], so a
// region of one world's page renders in another world. Physics comes from the host page's :root;
// colour mode stays page-level (the host's data-mode or the system preference).
const enclaves = (hostDarkFirst = false) => withResolvedTokens((resolve, resolver) => valuesOnly(css({
  filename: hostDarkFirst ? "css/enclaves-dark.css" : "css/enclaves.css",
  variableName,
  transform: withUnit,
  permutations: worlds.flatMap((name) => {
    const scope = `[data-world="${name}"]`;
    const light = {
      input: { world: name, mode: "light" },
      include: ["color.**", "world.**"],
      prepare: (body) => `${scope} {\n${body}\n${extras(resolver(), name, resolve({ world: name, mode: "light", output: "web" }))}\n}\n${motionBlocks(scope)}`,
    };
    const dark = { input: { world: name, mode: "dark" }, include: ["color.**"] };
    return [light, ...darkBlocks(dark, scope, hostDarkFirst), printBlock({ input: light.input }, scope)];
  }),
})));

export default defineConfig({
  tokens: ["./resolver.json"],
  outDir: "./dist/",
  plugins: [worldBindings(), ...Object.keys(contexts).map(world), enclaves(), enclaves(true), valuesOnly(sass({ filename: "scss/tokens.scss" })), layoutLiterals(), frameOutput(), worldMatrix()],
});
