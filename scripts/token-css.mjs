// Shared CSS output for publication worlds, enclaves and neutral fixtures.
import { readFileSync } from "node:fs";
import { spring } from "motion";
import { resolvedTokens } from "./resolved-tokens.mjs";

export const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

export const variableName = (token) => `--${token.id.replace(/\./g, "-")}`;

// Font-face descriptors cannot read custom properties. Emit measured fallback
// metadata as literals in the same resolved web output as the family stack.
export function fontFallbacks(tokens) {
  return Object.values(tokens).flatMap(token => {
    const fallback = token.$extensions?.['design-tokens.web-fallback'];
    if (!fallback) return [];
    if (token.$type !== 'fontFamily' || !token.$value.includes(fallback.family)) {
      throw new Error('A web fallback must occur in its font family stack');
    }
    return fallback.faces.map(face => {
      if (![fallback.ascent, fallback.descent, face.sizeAdjust].every(value => Number.isFinite(value) && value > 0)
        || !/^\d+( \d+)?$/.test(face.weight) || !face.local?.length) {
        throw new Error('A web fallback needs measured metrics, weight and local faces');
      }
      const metric = value => Number((value / (face.sizeAdjust / 100)).toFixed(3));
      return `@font-face { font-family: ${JSON.stringify(fallback.family)}; src: ${face.local.map(name => `local(${JSON.stringify(name)})`).join(', ')}; font-style: normal; font-weight: ${face.weight}; size-adjust: ${face.sizeAdjust}%; ascent-override: ${metric(fallback.ascent)}%; descent-override: ${metric(fallback.descent)}%; line-gap-override: 0%; }`;
    });
  }).join('\n');
}

// DTCG dimensions allow only px/rem, so ch, em, deg and s quantities are `number` tokens that name
// their unit in $extensions. CSS output appends that unit; `wdth` stays a bare axis value.
const CSS_UNITS = new Set(["ch", "em", "deg", "s"]);
export const withUnit = (token) => {
  const unit = token.$extensions?.["design-tokens.unit"];
  if (token.$type !== "number" || token.aliasOf || !CSS_UNITS.has(unit)) return undefined;
  return `${token.$value}${unit}`;
};

// Springs are tokens in Motion's own parameters (visual-duration in seconds, bounce 0–1). Static
// themes cannot run Motion, so each spring is also emitted as a CSS linear() easing plus the
// duration Motion computes for it, using Motion's spring generator at build time (no network).
export const springCss = (name, tokens, prefix) => {
  const resolved = resolvedTokens(tokens);
  const visual = resolved[`${prefix}.visual-duration`]?.$value;
  const bounce = resolved[`${prefix}.bounce`]?.$value;
  if (!Number.isFinite(visual) || !Number.isFinite(bounce)) {
    throw new Error(`${name}: spring parameters must resolve to finite numbers (duration=${JSON.stringify(visual)}, bounce=${JSON.stringify(bounce)})`);
  }
  const [duration, easing] = String(spring(visual, bounce)).split(/ (.+)/);
  return `  --${name}-duration: ${duration};\n  --${name}-easing: ${easing};`;
};

export const productiveSpring = (tokens) => springCss(
  "motion-spring-productive",
  tokens, "motion.spring.productive",
);

// CSS prepare() receives only text. Bind its token reads to the same resolver the
// plugin is building, after DTCG aliases and context overrides have been applied.
export const withResolvedTokens = (createPlugin) => {
  let resolver;
  const plugin = createPlugin((input) => resolver.apply(input), () => resolver);
  return {
    ...plugin,
    build(context) {
      resolver = Object.create(context.resolver);
      resolver.apply = (...args) => resolvedTokens(context.resolver.apply(...args));
      return plugin.build({ ...context, resolver });
    },
  };
};

// Sample a damped spring's normalised response once at build time, keeping
// the curve itself instead of substituting a cubic bezier. No per-frame
// JavaScript ships.
export function sampledCardCurve(bounce, steps) {
  const zeta = Math.max(0.2, Math.min(1, 1 - 0.6 * bounce));
  const w0 = 6.2 / zeta;
  const values = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const x = zeta >= 0.999
      ? 1 - (1 + w0 * t) * Math.exp(-w0 * t)
      : 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + zeta * w0 / wd * Math.sin(wd * t));
    return Math.round(x * 1e4) / 1e4;
  });
  values[0] = 0;
  values[values.length - 1] = 1;
  return `linear(${values.join(', ')})`;
}
export const bookmarkEasing = (tokens) =>
  `  --motion-bookmark-easing: ${sampledCardCurve(tokens['motion.bookmark.bounce'].$value, tokens['motion.bookmark.samples'].$value)};`;

// The 1.6 s film navigation uses Lenis's MIT-licensed default curve:
// min(1, 1.001 - 2 ** (-10 * t)). Film tokens supply its duration and parameters.
// Sample it into CSS linear(); the emitted CSS runs without Lenis.
export function sampledFilmNavigationCurve(exponent, offset, steps) {
  const values = Array.from({length: steps + 1}, (_, i) =>
    Math.min(1, offset - 2 ** (-exponent * i / steps)));
  values[0] = 0;
  values[values.length - 1] = 1;
  return `linear(${values.join(', ')})`;
}
export const filmNavigationEasing = (tokens) =>
  `  --film-navigation-easing: ${sampledFilmNavigationCurve(tokens['film.navigation-exponent'].$value, tokens['film.navigation-offset'].$value, tokens['film.navigation-samples'].$value)};`;

// Behavioural pattern choices ($extensions design-tokens.pattern on a world group or token)
// become string custom properties named after the path, e.g. --world-geometry-plate-edge-pattern.
export const patternCss = (patterns) => [...patterns]
  .filter(([id]) => id !== 'world.mode.default')
  .map(([id, pattern]) => `  --${id.replaceAll('.', '-')}-pattern: ${pattern};`).join('\n');

// The world-bound extras every :root or enclave block carries: the world's expressive spring
// and its pattern choices.
export const worldExtras = (patterns, tokens) =>
  `${springCss("world-motion-expressive-spring", tokens, "world.motion.expressive-spring")}\n${patternCss(patterns)}`;

// Rebind the consumer roles where their world values are defined. An enclave
// must resolve its own expressive motion instead of inheriting the host's result.
// Components still own their static composition and playback lifecycle.
export const motionBlocks = (scope = ":root") => {
  const reduced = `  --expressive-duration: calc(var(--motion-reduced-expressive) * var(--world-motion-reduced-expressive-scale,1));
  --expressive-easing: var(--world-motion-reduced-expressive-easing,var(--motion-reduced-easing));
  --expressive-decay: var(--world-motion-reduced-decay,var(--motion-reduced-decay));
  --preview-duration: var(--motion-reduced-preview-select);
  --preview-art-duration: var(--motion-reduced-preview-art);
  --preview-art-scale: var(--motion-reduced-preview-art-scale);
  --preview-lift: var(--motion-reduced-preview-lift);
  --deck-body-duration: var(--motion-reduced-result);`;
  const inner = scope === ":root" ? "" : ` ${scope}`;
  return `${scope} {
  --expressive-duration: calc(var(--duration-expressive) * var(--world-motion-expressive-scale,1));
  --expressive-easing: var(--world-motion-expressive-easing,var(--easing-productive));
  --expressive-decay: var(--world-motion-decay,var(--duration-expressive));
  --preview-duration: var(--duration-preview-select);
  --preview-art-duration: var(--duration-preview-art);
  --preview-art-scale: var(--scale-preview-art);
  --preview-lift: var(--motion-preview-lift);
  --deck-body-duration: var(--duration-result);
}
:root[data-motion="reduce"]${inner} {
${reduced}
}
@media (prefers-reduced-motion: reduce) {
:root:not([data-motion="allow"])${inner} {
${reduced}
}
}`;
};

// Colour-mode blocks: light resolves everything; dark rebinds only the semantic colour roles, so
// an explicit dark choice and the system preference render identically.
export const darkBlocks = (dark, scope, darkFirst) => {
  const inner = scope ? ` ${scope}` : "";
  const isDarkFirst = () => typeof darkFirst === 'function' ? darkFirst() : darkFirst;
  return [
    { ...dark, prepare: body => isDarkFirst()
      ? `:root:not([data-mode])${inner}, :root[data-mode="dark"]${inner} {\n${body}\n}`
      : `:root[data-mode="dark"]${inner} {\n${body}\n}` },
    { ...dark, prepare: body => isDarkFirst()
      ? `@media (prefers-color-scheme: dark) {\n:root[data-mode="system"]${inner} {\n${body}\n}\n}`
      : `@media (prefers-color-scheme: dark) {\n:root:not([data-mode="light"])${inner} {\n${body}\n}\n}` },
  ];
};

// Paper uses each world's existing light roles, independently of the saved screen
// preference. Importance is local to print so every explicit/system binding yields.
export const printBlock = (light, scope = "") => ({
  ...light,
  include: ["color.**"],
  prepare: (body) => `@media print {\n${scope || ":root"} {\n${body.replaceAll(";", " !important;")}\n}\n}`,
});
