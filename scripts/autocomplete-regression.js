// Browser regression: delayed autocomplete must be clicked, not merely typed.
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { runTest } from '../src/runner.js';
const server = createServer((req, res) => {
 res.setHeader('Content-Type', 'text/html');
 res.end(`<!doctype html><label>Airport<input id="query"></label>
<div hidden>Delhi DEL</div><div id="results"></div><p id="selected">No airport selected</p>
<script>let timer;query.oninput=()=>{clearTimeout(timer);results.innerHTML='';timer=setTimeout(()=>{results.innerHTML='<div id="choice">Delhi DEL</div>';choice.onclick=()=>{selected.textContent='Selected airport: DEL';results.innerHTML='';};},600);};</script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
 const actions = [
  { action: 'fill', target: { by: 'label', name: 'Airport' }, value: 'Delhi' },
  { action: 'assert', target: { by: 'css', selector: '#selected' }, condition: 'text_contains', value: 'No airport selected' },
  { action: 'click', target: { by: 'text', name: 'Delhi DEL' } },
  { action: 'assert', target: { by: 'css', selector: '#selected' }, condition: 'text_contains', value: 'Selected airport: DEL' },
  { action: 'assert', target: { by: 'label', name: 'Airport' }, condition: 'value_equals', value: 'Delhi' },
  { action: 'finish', reason: 'Delayed suggestion selected despite hidden duplicate; typing alone did not select it.' }
 ];
 const result = await runTest({ url: `http://127.0.0.1:${server.address().port}`, test: 'Select a delayed airport suggestion', maxSteps: actions.length,
  decide: async state => {
   if (state.history.length === 1) assert.match(state.snapshot, /Delhi DEL/);
   return actions.shift();
  } });
 assert.equal(result.status, 'PASS', result.reason);
 assert.equal(result.steps.filter(s => s.ok === false).length, 0);
 console.log(`Autocomplete regression PASS: ${result.directory}`);
} finally { server.close(); }
