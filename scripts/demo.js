// Deterministic browser integration demo. This does NOT exercise the AI planner.
import { createServer } from 'node:http';
import { runTest } from '../src/runner.js';
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><title>QA fixture</title><h1>Customer login</h1><form><label>Email<input type="email"></label><label>Password<input type="password"></label><button>Log in</button></form><script>document.querySelector('form').onsubmit=e=>{e.preventDefault();document.body.innerHTML='<h1>Dashboard</h1><p>Welcome, customer</p>'}</script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const target = name => ({ by: 'label', name });
try {
  for (const negative of [false, true]) {
    const actions = [
      { action: 'fill', target: target('Email'), value: '{{TEST_EMAIL}}' },
      { action: 'fill', target: target('Password'), value: '{{TEST_PASSWORD}}' },
      { action: 'click', target: { by: 'role', role: 'button', name: 'Log in' } },
      { action: 'assert', target: { by: 'role', role: 'heading', name: negative ? 'Missing dashboard' : 'Dashboard' }, condition: 'visible' },
      { action: 'finish', reason: 'Dashboard verified' }
    ];
    const result = await runTest({ url, test: 'Log in and verify the dashboard is shown',
      credentials: { TEST_EMAIL: 'demo@example.test', TEST_PASSWORD: 'demo-secret' },
      maxSteps: actions.length, decide: async () => actions.shift() });
    console.log(`${negative ? 'Negative' : 'Positive'} integration case: ${result.status} — ${result.directory}`);
    if (result.status !== (negative ? 'FAIL' : 'PASS')) process.exitCode = 1;
  }
} finally { server.close(); }
