import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModel, SYSTEM } from '../src/model.js';

const env = { GEMINI_API_KEY: 'test-key' };
const reply = data => ({ ok: true, json: async () => data });
const candidate = text => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });

test('Gemini request carries system instructions, browser state and JSON mode', async () => {
  const state = { test: 'Check heading', snapshot: 'heading: Example' };
  const decide = createModel(env, async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.systemInstruction.parts[0].text, SYSTEM);
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), state);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseSchema.required.includes('condition'));
    assert.ok(body.generationConfig.responseSchema.required.includes('goal'));
    return reply(candidate('{"action":"wait"}'));
  });
  assert.deepEqual(await decide(state), { action: 'wait' });
});

test('Gemini model override is used', async () => {
  await createModel({ ...env, GEMINI_MODEL: 'gemini-custom-flash' }, async url => {
    assert.match(url, /models\/gemini-custom-flash:generateContent$/);
    return reply(candidate('{"action":"finish"}'));
  })({});
});

test('Gemini quota errors are actionable and do not expose key', async () => {
  await assert.rejects(createModel(env, async () => ({ ok: false, status: 429 }))({}), error => {
    assert.match(error.message, /429.*quota/);
    assert.ok(!error.message.includes(env.GEMINI_API_KEY));
    return true;
  });
});

test('invalid, empty, blocked and incomplete Gemini responses fail clearly', async () => {
  for (const [data, expected] of [
    [candidate('not json'), /invalid JSON/],
    [candidate('{"action":"execute"}'), /unsupported browser action/],
    [{ candidates: [] }, /no text action/],
    [{ promptFeedback: { blockReason: 'SAFETY' } }, /blocked/],
    [{ candidates: [{ finishReason: 'MAX_TOKENS' }] }, /did not complete/]
  ]) await assert.rejects(createModel(env, async () => reply(data))({}), expected);
});

test('Gemini timeouts identify the provider and configured deadline', async () => {
  await assert.rejects(createModel({ ...env, GEMINI_TIMEOUT_MS: '1000' }, async () => {
    throw new DOMException('timed out', 'TimeoutError');
  })({}), /Gemini request timed out after 1s.*No browser decision/);
});

test('invalid Gemini timeout configuration fails before requesting', () => {
  for (const value of ['abc', '0', '300001']) {
    assert.throws(() => createModel({ ...env, GEMINI_TIMEOUT_MS: value }), /GEMINI_TIMEOUT_MS/);
  }
});

test('temporary Gemini errors retry with bounded backoff then recover', async () => {
  let calls = 0;
  let cancelled = 0;
  const delays = [];
  const decide = createModel(env, async () => {
    calls++;
    return calls < 3 ? { ok: false, status: 503, body: { cancel: async () => cancelled++ } } : reply(candidate('{"action":"wait"}'));
  }, async ms => delays.push(ms));
  assert.deepEqual(await decide({}), { action: 'wait' });
  assert.equal(calls, 3);
  assert.equal(cancelled, 2);
  assert.deepEqual(delays, [2000, 4000]);
});

test('persistent Gemini service errors stop after three attempts', async () => {
  let calls = 0;
  const decide = createModel(env, async () => { calls++; return { ok: false, status: 503 }; }, async () => {});
  await assert.rejects(decide({}), /503.*unavailable after 3 attempts/);
  assert.equal(calls, 3);
});

test('authentication and quota errors are not retried', async () => {
  for (const status of [400, 401, 403, 404, 429]) {
    let calls = 0;
    const decide = createModel(env, async () => { calls++; return { ok: false, status }; }, async () => assert.fail('Unexpected retry'));
    await assert.rejects(decide({}), new RegExp(String(status)));
    assert.equal(calls, 1);
  }
});

test('invalid model output gets one correction request with feedback', async () => {
 let calls=0;
 const decide=createModel(env,async (url,options)=>{
  calls++;
  if(calls===1) return reply(candidate('{"action":"fill","target":{"ref":"e1"}}'));
  const state=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
  assert.match(state.validationFeedback,/value must be a string/);
  return reply(candidate('{"action":"wait"}'));
 });
 assert.deepEqual(await decide({}),{action:'wait'});assert.equal(calls,2);
});
