import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const worlds = Object.keys(read('resolver.json').modifiers.world.contexts).filter(name => name !== 'neutral');

test('each world and colour mode has complete frame values and matching input hashes', () => {
  for (const world of worlds) for (const mode of ['light', 'dark']) {
    const output = read(`dist/frame/${world}-${mode}.json`);
    assert.equal(output.world, world);
    assert.equal(output.mode, mode);
    assert.equal(Object.keys(output.variables).length, 18);
    assert.ok(output.fonts.display.length);
    for (const [name, variable] of Object.entries(output.variables)) {
      assert.ok(output.css.includes(`--${name}: ${variable.default};`));
    }
    for (const profile of Object.values(output.profiles)) {
      assert.ok(Number.isInteger(profile.width) && profile.width > 0);
      assert.ok(Number.isInteger(profile.height) && profile.height > 0);
      assert.ok(Number.isInteger(profile.fps) && profile.fps > 0);
    }
    for (const input of output.sourceInputs) {
      assert.equal(createHash('sha256').update(readFileSync(new URL(input.path, root))).digest('hex'), input.sha256);
    }
  }
});

test('frame-only values never ship in website styles', () => {
  for (const path of [...worlds.map(world => `dist/css/${world}.css`), 'dist/css/base.css', 'dist/css/enclaves.css', 'dist/scss/tokens.scss']) {
    const text = readFileSync(new URL(path, root), 'utf8');
    assert.ok(!text.includes('--frame-safe-'), path);
    assert.ok(!text.includes('--frame-canvas-'), path);
    assert.ok(!text.includes('--frame-type-'), path);
  }
});

test('light and dark retain distinct world grounds and their source font family', () => {
  for (const world of worlds) {
    const light = read(`dist/frame/${world}-light.json`);
    const dark = read(`dist/frame/${world}-dark.json`);
    assert.notEqual(light.variables.bg.default, dark.variables.bg.default);
    const source = read(`tokens/worlds/${world}.tokens.json`);
    assert.deepEqual(light.fonts.display, source.world.type.display.family.$value);
    assert.deepEqual(dark.fonts.display, light.fonts.display);
  }
});

test('all fourteen compact outputs retain typed expression without embedded explanations', () => {
  const groups = ['material', 'raster', 'geometry', 'depth', 'emission', 'type', 'motion', 'crop', 'figure'];
  for (const world of worlds) for (const mode of ['light', 'dark']) {
    const output = read(`dist/frame/${world}-${mode}.json`);
    assert.equal(output.format, 'design-tokens.frame.v1');
    assert.ok(!('roleSources' in output));
    assert.ok(output.sourceInputs.length);
    assert.deepEqual(Object.keys(output.expression), groups);
    for (const [group, body] of Object.entries(output.expression)) {
      assert.ok(Object.keys(body.tokens).length, `${world}/${group}`);
      for (const [id, token] of Object.entries(body.tokens)) {
        assert.ok(token.type && token.css !== undefined && token.value !== undefined, id);
        if (token.type === 'dimension' || token.type === 'duration') assert.ok(token.unit, id);
        assert.ok(!('description' in token), id);
      }
      for (const pattern of Object.values(body.patterns)) {
        assert.equal(pattern.type, 'pattern');
        assert.equal(pattern.value, pattern.css);
      }
    }

  }
});

test('frame size and motion adaptation derive from existing roles without replacing their values', () => {
  for (const world of worlds) for (const mode of ['light', 'dark']) {
    const output = read(`dist/frame/${world}-${mode}.json`), a = output.adaptation;
    const type = output.expression.type.tokens, motion = output.expression.motion.tokens;
    assert.equal(a.sizeScale, a.type.body.value / type['type.size.body'].value);
    assert.equal(a.motionScale, a.motion.transition.value / motion['duration.expressive'].value);
    assert.equal(a.motion.expressiveDuration.value, a.motion.transition.value * motion['world.motion.expressive-scale'].value);
    assert.equal(a.motion.emissionDecay.value, motion['world.motion.decay'].value * a.motionScale);
    assert.equal(a.motion.expressiveDuration.unit, 'ms');
    assert.equal(a.motion.emissionDecay.unit, 'ms');
    assert.ok(output.css.includes('--frame-world-depth-offset: calc(var(--world-depth-offset) * var(--frame-size-scale));'));
    assert.ok(output.css.includes('--frame-world-motion-decay: calc(var(--world-motion-decay) * var(--frame-motion-scale));'));
    assert.ok(output.css.includes(`--world-motion-expressive-easing: ${motion['world.motion.expressive-easing'].css};`));
  }
});
