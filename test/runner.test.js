import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModel } from '../src/model.js';
import { locator } from '../src/runner.js';
test('missing model credentials fail clearly', () => assert.throws(() => createModel({}), /GEMINI_API_KEY/));
test('unsupported locators cannot execute arbitrary code', () => assert.throws(() => locator({}, { by: 'eval', name: 'x' }), /Unsupported/));
test('exact accessible role selectors', () => {
  const page = { getByRole: (role, options) => ({ role, options }) };
  assert.deepEqual(locator(page, { by: 'role', role: 'button', name: 'Login' }), { role: 'button', options: { name: 'Login', exact: true } });
});

test('stale element references cannot accidentally click a different current element', () => {
 const current=new Map([['o2e1',{identity:'current'}]]);
 assert.throws(()=>locator({}, {ref:'o1e1'},current),/Unknown element ref/);
 assert.deepEqual(locator({}, {ref:'o2e1'},current),{identity:'current'});
});
