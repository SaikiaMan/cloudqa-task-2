// Live Gemini integration against a local fixture; no real accounts or external writes.
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { createModel } from '../src/model.js';
import { runTest } from '../src/runner.js';

const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.url === '/details') {
    res.end('<!doctype html><title>Account details</title><h1>Account details</h1><p>Test account is active</p>');
    return;
  }
  res.end(`<!doctype html><title>Local QA playground</title><h1>Customer login</h1>
<form id="login"><label>Email<input type="email" id="email" required></label>
<label>Password<input type="password" id="password" required></label><button>Log in</button></form>
<p role="alert" id="error"></p>
<script>
document.getElementById('login').onsubmit=e=>{
 e.preventDefault();
 if(document.getElementById('email').value!=='qa@example.test'||document.getElementById('password').value!=='local-test-password'){
 document.getElementById('error').textContent='Invalid credentials';return;}
 document.body.innerHTML='<h1>Dashboard</h1><form id="prefs"><label>Country<select id="country"><option value="">Choose country</option><option value="IN">India</option><option value="US">United States</option></select></label><label><input id="notify" type="checkbox">Email notifications</label><button>Save preferences</button></form><p role="status" id="status"></p><a href="/details">Account details</a>';
 document.getElementById('prefs').onsubmit=e=>{e.preventDefault();document.getElementById('status').textContent='Saved: '+document.getElementById('country').selectedOptions[0].text+'; notifications '+(document.getElementById('notify').checked?'enabled':'disabled');};
};
</script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const decide = createModel();
const headed = process.argv.includes('--headed');
const watchDecide = async state => {
  if (headed) await new Promise(resolve => setTimeout(resolve, 1500));
  return decide(state);
};
const cases = [
  { name: 'Login, preferences and navigation', expected: 'PASS', test: 'Log in using {{TEST_EMAIL}} and {{TEST_PASSWORD}}. Verify the Dashboard heading is visible. Select India in Country and check Email notifications. Click Save preferences and verify the status says Saved: India; notifications enabled. Click Account details. Verify the URL contains /details and the Account details heading is visible.' },
  { name: 'Incorrect heading is rejected', expected: 'FAIL', test: 'Verify the heading Payment complete is visible on the initial page. If it is missing, report failure; do not navigate elsewhere.' }
];
const results = [];
try {
 for (const item of cases) {
   console.log(`\nLive AI case: ${item.name}`);
   const result = await runTest({ url, test: item.test, decide: watchDecide, headed, maxSteps: 22,
     credentials: { TEST_EMAIL: 'qa@example.test', TEST_PASSWORD: 'local-test-password' } });
   results.push({ name: item.name, expected: item.expected, actual: result.status, reason: result.reason, report: result.directory, actions: result.steps.map(s => ({ action: s.action, ok: s.ok, condition: s.condition })) });
   console.log(`${result.status} (expected ${item.expected}): ${result.reason}\nReport: ${result.directory}`);
   if (result.status !== item.expected) process.exitCode = 1;
 }
 await writeFile('reports/ai-flows-summary.json', JSON.stringify(results, null, 2));
} finally { server.close(); }
