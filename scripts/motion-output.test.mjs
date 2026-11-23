import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
let chromium;
try { ({chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')); } catch {}

test('motion roles follow explicit and system choices in every world and enclave',
  {skip: !chromium && 'Playwright unavailable; computed-style proof not run'}, async () => {
    const browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL});
    try {
      const page = await browser.newPage();
      const worlds = Object.keys(JSON.parse(read('resolver.json')).modifiers.world.contexts).filter(name => name !== 'neutral');
      // Read the public roles through actual CSS properties. The references use
      // the canonical inputs directly, independent of the emitted bindings.
      const probes = `
        .motion, .normal, .reduced { transition-property: opacity; }
        .motion {
          transition-duration: var(--expressive-duration), var(--expressive-decay), var(--preview-duration), var(--preview-art-duration), var(--deck-body-duration);
          transition-timing-function: var(--expressive-easing);
          scale: var(--preview-art-scale);
          translate: 0 var(--preview-lift);
        }
        .normal {
          transition-duration: calc(var(--duration-expressive) * var(--world-motion-expressive-scale)), var(--world-motion-decay), var(--duration-preview-select), var(--duration-preview-art), var(--duration-result);
          transition-timing-function: var(--world-motion-expressive-easing);
          scale: var(--scale-preview-art);
          translate: 0 var(--motion-preview-lift);
        }
        .reduced {
          transition-duration: calc(var(--motion-reduced-expressive) * var(--world-motion-reduced-expressive-scale)), var(--world-motion-reduced-decay), var(--motion-reduced-preview-select), var(--motion-reduced-preview-art), var(--motion-reduced-result);
          transition-timing-function: var(--world-motion-reduced-expressive-easing);
          scale: var(--motion-reduced-preview-art-scale);
          translate: 0 var(--motion-reduced-preview-lift);
        }`;
      const sample = '<i class="motion"></i><i class="normal"></i><i class="reduced"></i>';
      let comparisons = 0;
      for (const host of ['base', ...worlds]) {
        await page.setContent(`<style>${read(`dist/css/${host}.css`)}
          ${read(`dist/css/enclaves${host === 'nocturne' ? '-dark' : ''}.css`)}${probes}</style>
          <section data-sample="host">${sample}</section>
          ${worlds.map(world => `<section data-world="${world}" data-sample="${world}">${sample}</section>`).join('')}`);
        for (const mode of ['light', 'dark']) for (const os of ['no-preference', 'reduce']) {
          await page.emulateMedia({reducedMotion: os});
          // Mutate preferences on the same document to cover both directions,
          // including an explicit Full choice overriding a reduced OS setting.
          for (const motion of ['', 'reduce', 'allow', 'system']) {
            await page.evaluate(({mode, motion}) => {
              document.documentElement.dataset.mode = mode;
              if (motion) document.documentElement.dataset.motion = motion;
              else document.documentElement.removeAttribute('data-motion');
            }, {mode, motion});
            const reduced = motion === 'reduce' || (os === 'reduce' && motion !== 'allow');
            const samples = await page.locator('[data-sample]').evaluateAll((elements, reduced) => {
              const properties = ['transitionDuration', 'transitionTimingFunction', 'scale', 'translate'];
              const values = element => {
                const style = getComputedStyle(element);
                return properties.map(property => style[property]);
              };
              return elements.map(element => ({
                world: element.dataset.sample,
                actual: values(element.querySelector('.motion')),
                expected: values(element.querySelector(reduced ? '.reduced' : '.normal')),
              }));
            }, reduced);
            for (const {world, actual, expected} of samples) {
              assert.deepEqual(actual, expected, JSON.stringify({host, world, mode, os, motion}));
              assert.notEqual(actual[0], '0s', 'duration roles must resolve');
              comparisons++;
            }
          }
        }
      }
      assert.equal(comparisons, 1024);
    } finally { await browser.close(); }
  });
