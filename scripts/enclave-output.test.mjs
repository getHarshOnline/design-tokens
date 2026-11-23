import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
let chromium;
try { ({chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')); } catch {}

test('enclave colours follow the selected host mode policy, not the target world default',
  {skip: !chromium && 'Playwright unavailable; computed-style proof not run'}, async () => {
    const browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL});
    try {
      const page = await browser.newPage();
      const worlds = Object.keys(JSON.parse(read('resolver.json')).modifiers.world.contexts).filter(name => name !== 'neutral');
      const expected = {};
      for (const target of worlds) for (const mode of ['light', 'dark']) {
        await page.setContent(`<html data-mode="${mode}"><style>${read(`dist/css/${target}.css`)}
          .sample {color:var(--color-paper)}</style><div class="sample">Sample</div></html>`);
        expected[`${target}/${mode}`] = await page.locator('.sample').evaluate(el => getComputedStyle(el).color);
      }
      for (const hostDark of [false, true]) for (const mode of ['', 'light', 'dark', 'system']) {
        for (const os of ['light', 'dark']) for (const target of worlds) {
          await page.emulateMedia({colorScheme: os, media: 'screen'});
          await page.setContent(`<html ${mode ? `data-mode="${mode}"` : ''}>
            <style>${read(`dist/css/enclaves${hostDark ? '-dark' : ''}.css`)}
            .sample {color:var(--color-paper)}</style><div data-world="${target}" class="sample">Sample</div></html>`);
          const resolved = mode === 'light' || mode === 'dark' ? mode : !mode && hostDark ? 'dark' : os;
          assert.equal(await page.locator('.sample').evaluate(el => getComputedStyle(el).color),
            expected[`${target}/${resolved}`], JSON.stringify({hostDark, mode, os, target}));
          await page.emulateMedia({media: 'print'});
          assert.equal(await page.locator('.sample').evaluate(el => getComputedStyle(el).color), expected[`${target}/light`]);
        }
      }
    } finally { await browser.close(); }
  });
