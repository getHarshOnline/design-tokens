import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvedTokens } from './resolved-tokens.mjs';

test('residual aliases retain falsy values through chains and composites without mutation', () => {
  const table = { zero: {$value: 0}, alias: {$value: '{zero}'}, chain: {$value: '{alias}'},
    shape: {$value: {size: '{chain}', values: ['{zero}', 2]}},
    empty: {$value: ''}, text: {$value: '{empty}'} };
  const before = JSON.stringify(table), result = resolvedTokens(table);
  assert.equal(result.chain.$value, 0);
  assert.equal(result.text.$value, '');
  assert.deepEqual(result.shape.$value, {size: 0, values: [0, 2]});
  assert.equal(JSON.stringify(table), before);
});

test('unresolved targets and cycles refuse output rather than leaking an alias string', () => {
  assert.throws(() => resolvedTokens({a: {$value: '{missing}'}}), /Missing/);
  assert.throws(() => resolvedTokens({a: {$value: '{b}'}, b: {$value: '{a}'}}), /Cyclic/);
});
