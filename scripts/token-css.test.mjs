import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { spring } from 'motion';
import { sampledCardCurve, sampledFilmNavigationCurve } from './token-css.mjs';

test('one build resolves derived values, neutral fixtures and a newly declared world', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const fixture = mkdtempSync(join(tmpdir(), 'token-spring-alias-'));
  try {
    for (const name of ['package.json', 'package-lock.json', 'resolver.json', 'terrazzo.config.mjs', 'scripts', 'tokens']) {
      cpSync(join(root, name), join(fixture, name), { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    const update = (name, change) => {
      const path = join(fixture, name), data = JSON.parse(readFileSync(path, 'utf8'));
      change(data); writeFileSync(path, JSON.stringify(data));
    };
    update('tokens/physics/motion.tokens.json', data => {
      data.motion.spring.parameters = {
        duration: { $type: 'number', $value: .25 },
        bounce: { $type: 'number', $value: 0 },
      };
      data.motion.spring.productive['visual-duration'].$value = '{motion.spring.parameters.duration}';
      data.motion.spring.productive.bounce.$value = '{motion.spring.parameters.bounce}';
      data.motion.bookmark.bounce.$value = '{motion.spring.parameters.bounce}';
      data.fixture = { literal: { $type: 'fontFamily', $value: ['keep /* value */ and https://example.test', 'serif'], $description: 'Do not print this description.' } };
    });
    update('tokens/worlds/carrier.tokens.json', data => {
      data.world.motion['expressive-spring']['visual-duration'].$value = '{motion.spring.productive.visual-duration}';
      data.world.motion['expressive-scale'].$value = '{motion.spring.parameters.bounce}';
      data.world.motion['expressive-spring'].bounce.$value = '{motion.spring.productive.bounce}';
    });
    update('tokens/base/neutral.tokens.json', data => {
      data.world.motion['expressive-spring']['visual-duration'].$value = '{motion.spring.productive.visual-duration}';
      data.world.motion['expressive-scale'].$value = '{motion.spring.parameters.bounce}';
      data.world.motion['expressive-spring'].bounce.$value = '{motion.spring.productive.bounce}';
    });
    update('tokens/physics/layout.tokens.json', data => {
      data.layout['field-max'].$value = '{space.4}';
      data.layout['shell-width'].$value = {value: 736, unit: 'px'};
    });
    const newWorld = JSON.parse(readFileSync(join(fixture, 'tokens/worlds/carrier.tokens.json'), 'utf8'));
    newWorld.world.mode.default.$extensions['design-tokens.pattern'] = 'dark';
    newWorld.world.geometry.$extensions['design-tokens.pattern'] = 'fixture-pattern';
    newWorld.motion = { bookmark: { samples: { $type: 'number', $value: 8 } } };
    newWorld.film = {
      'navigation-exponent': { $type: 'number', $value: '{motion.spring.parameters.duration}' },
      'navigation-offset': { $type: 'number', $value: 1 },
      'navigation-samples': { $type: 'number', $value: 8 },
    };
    writeFileSync(join(fixture, 'tokens/worlds/fixture.tokens.json'), JSON.stringify(newWorld));
    update('tokens/modes/dark.tokens.json', data => {
      data.world = { geometry: { $extensions: { 'design-tokens.pattern': 'mode-pattern' } } };
    });
    update('tokens/physics/crossing.tokens.json', data => {
      data.crossing.fixture = structuredClone(data.crossing.carrier);
    });
    for (const mode of ['light', 'dark']) update(`tokens/modes/${mode}.tokens.json`, data => {
      data.color.crossing.fixture = { $type: 'color', $value: `{crossing.fixture.${mode}}` };
    });
    update('tokens/outputs/frame.tokens.json', data => {
      data.world = { geometry: { $extensions: { 'design-tokens.pattern': 'frame-pattern' } } };
    });
    update('resolver.json', data => {
      data.modifiers.world.contexts.fixture = [{ $ref: 'tokens/worlds/fixture.tokens.json' }];
    });
    const cli = realpathSync(join(root, 'node_modules/.bin/tz'));
    execFileSync(process.execPath, [cli, 'build'], { cwd: fixture, stdio: 'pipe' });
    const [duration, easing] = String(spring(.25, 0)).split(/ (.+)/);
    for (const file of ['carrier.css', 'base.css']) {
      const css = readFileSync(join(fixture, 'dist/css', file), 'utf8');
      assert.equal((css.match(/@font-face/g) ?? []).length, 2, file);
      assert.ok(css.includes('size-adjust: 102.63%'), file);
      assert.ok(css.includes('ascent-override: 94.514%'), file);
      assert.ok(css.includes('Instrument Sans Fallback'), file);
      assert.ok(css.includes('--layout-dock: 30rem;'), file);
      assert.ok(css.includes('--layout-dock-dense: var(--layout-shell-width);'), file);
      assert.ok(css.includes('--layout-shell-width: 736px;'), file);
      assert.ok(css.includes('--layout-stage-min: 20rem;'), file);
      assert.ok(css.includes('--target-compact: 32px;'), file);
      assert.ok(css.includes('--target-project: 44px;'), file);
      for (const prefix of ['motion-spring-productive', 'world-motion-expressive-spring']) {
        assert.ok(css.includes(`--${prefix}-duration: ${duration};`), `${file}: ${prefix} duration`);
        assert.ok(css.includes(`--${prefix}-easing: ${easing};`), `${file}: ${prefix} easing`);
      }
    }
    const frame = JSON.parse(readFileSync(join(fixture, 'dist/frame/carrier-light.json'), 'utf8'));
    assert.equal(frame.expression.motion.tokens['world.motion.expressive-scale'].value, 0);
    assert.equal(frame.expression.motion.tokens['world.motion.expressive-spring.bounce'].value, 0);
    assert.equal(frame.expression.type.tokens['type.numeric.width'].css, String(JSON.parse(readFileSync(join(fixture, 'tokens/physics/type.tokens.json'), 'utf8')).type.numeric.width.$value));
    const enclave = readFileSync(join(fixture, 'dist/css/enclaves.css'), 'utf8');
    const carrier = enclave.match(/\[data-world="carrier"\] \{([\s\S]*?)\n\}/)?.[1];
    assert.ok(carrier?.includes(`--world-motion-expressive-spring-duration: ${duration};`));
    const generated = readFileSync(join(fixture, 'dist/css/fixture.css'), 'utf8');
    assert.ok(generated.includes(':root:not([data-mode]), :root[data-mode="dark"]'));
    assert.ok(generated.includes(`--motion-bookmark-easing: ${sampledCardCurve(0, 8)};`));
    assert.ok(generated.includes(`--film-navigation-easing: ${sampledFilmNavigationCurve(.25, 1, 8)};`));
    assert.ok(generated.includes('keep /* value */ and https://example.test'));
    assert.ok(generated.includes('data-gazette-destination-theme="theme:fixture"'));
    assert.ok(readFileSync(join(fixture, 'dist/css/base.css'), 'utf8').includes('data-gazette-destination-theme="theme:fixture"'));
    assert.ok(!generated.includes('Do not print this description.'));
    assert.ok(enclave.includes('[data-world="fixture"]'));
    assert.ok(enclave.includes('--world-geometry-pattern: fixture-pattern;'));
    const fixtureFrame = JSON.parse(readFileSync(join(fixture, 'dist/frame/fixture-dark.json'), 'utf8'));
    assert.equal(fixtureFrame.world, 'fixture');
    const matrix = JSON.parse(readFileSync(join(fixture, 'dist/worlds.json'), 'utf8'));
    assert.ok(matrix.worlds.includes('fixture'));
    assert.ok(matrix.states.every(state => state.worlds.fixture));
    assert.equal(matrix.states.find(state => state.mode === 'light').worlds.fixture.geometry.patterns['world.geometry'], 'fixture-pattern');
    assert.equal(fixtureFrame.expression.geometry.patterns['world.geometry'].value, 'frame-pattern');
    const explanation = JSON.parse(execFileSync(process.execPath,
      [join(fixture, 'scripts/explain.mjs'), 'world.geometry', '--world', 'fixture', '--mode', 'dark', '--output', 'frame'],
      { cwd: root, encoding: 'utf8' }));
    assert.equal(explanation.pattern, 'frame-pattern');
    assert.equal(explanation.sources.at(-1).file, 'tokens/outputs/frame.tokens.json');
    const layout = readFileSync(join(fixture, 'dist/scss/_layout.scss'), 'utf8');
    assert.ok(layout.includes('$layout-field-max: 16px;'));
    assert.ok(layout.includes('$layout-dock: 30rem;'));
    assert.ok(layout.includes('$layout-dock-dense: 736px;'));
    assert.ok(layout.includes('$layout-stage-min: 20rem;'));
    update('tokens/world.roles.json', data => { delete data.world.depth.offset.$description; });
    assert.throws(() => execFileSync(process.execPath, [cli, 'build'], { cwd: fixture, stdio: 'pipe' }), error => {
      assert.match(String(error.stderr), /World roles lack shared meanings: world.depth.offset/);
      return true;
    });

  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
