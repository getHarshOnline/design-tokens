import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformCSSValue } from '@terrazzo/token-tools/css';
import { buildFrameExpression } from './frame-expression.mjs';
import { selectedPatterns } from './world-bindings.mjs';
import { resolvedTokens } from './resolved-tokens.mjs';

// The same resolver supplies world, mode and shared roles. Frame-only values
// enter only the explicit output context, so website artifacts do not grow.
export default function frameOutput() {
  return {
    name: 'frame-output',
    build({ resolver, outputFile }) {
      const root = fileURLToPath(new URL('..', import.meta.url));
      const list = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory() ? list(join(dir, entry.name)) : [join(dir, entry.name)]);
      const paths = ['resolver.json', 'terrazzo.config.mjs', 'scripts/frame-output.mjs', 'scripts/frame-expression.mjs', 'scripts/world-bindings.mjs', 'scripts/resolved-tokens.mjs', 'package.json', 'package-lock.json',
        ...list(join(root, 'tokens')).filter(path => path.endsWith('.json')).map(path => relative(root, path))].sort();
      const sourceInputs = paths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') }));
      const source = JSON.parse(readFileSync(new URL('../resolver.json', import.meta.url), 'utf8'));
      const worlds = Object.keys(source.modifiers.world.contexts).filter(name => name !== 'neutral').sort();
      for (const world of worlds) for (const mode of ['light', 'dark']) {
        const tokens = resolvedTokens(resolver.apply({ world, mode, output: 'frame' }));
        const value = id => {
          if (!tokens[id]) throw new Error(`Missing frame role: ${id}`);
          return tokens[id].$value;
        };
        const cssValue = id => {
          const token = tokens[id];
          if (!token) throw new Error(`Missing frame role: ${id}`);
          return transformCSSValue(token, {
            tokensSet: tokens,
            transformAlias: target => cssValue(target.id),
            color: { legacyHex: true },
          });
        };
        const bindings = {
          bg: 'color.paper', fg: 'color.ink', muted: 'color.muted', surface: 'color.sheet',
          border: 'color.line', brand: 'color.accent', accent: 'color.accent', 'accent-2': 'color.signal',
          'font-display': 'world.type.display.family', 'font-body': 'type.family.reading',
          'font-mono': 'type.family.system', radius: 'radius.control',
          'space-1': 'space.2', 'space-2': 'space.4', 'space-3': 'space.6',
          'dur-beat': 'frame.duration.reading-hold', 'ease-standard': 'world.motion.expressive-easing',
          'ease-emphasis': 'easing.productive',
        };
        const fontValue = token => {
          const family = value(token);
          const generic = family.at(-1);
          return JSON.stringify(family[0]) + (['serif', 'sans-serif', 'monospace'].includes(generic) ? `, ${generic}` : '');
        };
        const variables = Object.fromEntries(Object.entries(bindings).map(([id, token]) => [id, {
          type: token.includes('family') ? 'font' : token.startsWith('color.') ? 'color' : 'string',
          default: token.includes('family') ? fontValue(token) : cssValue(token),
        }]));
        const rules = Object.entries(variables).map(([id, item]) => `  --${id}: ${item.default};`);
        const frameBindings = {
          'frame-title-size': 'frame.type.title', 'frame-body-size': 'frame.type.body',
          'frame-caption-size': 'frame.type.caption', 'frame-leading': 'frame.type.leading',
          'frame-action-safe': 'frame.safe.action', 'frame-title-safe': 'frame.safe.title',
          'frame-transition': 'frame.duration.transition',
          'frame-display-weight': 'world.type.display.weight', 'frame-display-width': 'world.type.display.width',
          'frame-body-weight': 'type.weight.reading',
        };
        for (const [name, token] of Object.entries(frameBindings)) rules.push(`  --${name}: ${cssValue(token)};`);
        const profiles = Object.fromEntries(['landscape', 'portrait'].map(name => [name,
          Object.fromEntries(['width', 'height', 'fps'].map(key => [key, value(`frame.canvas.${name}.${key}`)])),
        ]));
        const inherited = buildFrameExpression({ tokens, patterns: selectedPatterns(resolver, { world, mode, output: 'frame' }), cssValue });
        const result = {
          format: 'design-tokens.frame.v1', world, mode, variables, profiles, sourceInputs,
          expression: inherited.expression, adaptation: inherited.adaptation,
          fonts: { display: value('world.type.display.family'), body: value('type.family.reading'), mono: value('type.family.system') },
          css: `:root {\n${[...rules, ...inherited.rules].join('\n')}\n  color-scheme: ${mode};\n}\n`,
        };
        outputFile(`frame/${world}-${mode}.json`, JSON.stringify(result, null, 2) + '\n');
      }
    },
  };
}
