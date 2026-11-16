// Live browser probe, explicitly independent of AI planning.
import { runTest } from '../src/runner.js';
const actions = [
  { action: 'assert', target: { by: 'role', role: 'heading', name: 'Get your demo access' }, condition: 'visible' },
  { action: 'finish', reason: 'The demo access heading is visible in a live browser.' }
];
const result = await runTest({ url: 'https://phptravels.com/demo', test: 'Verify the demo access section is shown', decide: async () => actions.shift(), maxSteps: 2 });
console.log(`${result.status}: ${result.reason}\n${result.directory}`);
process.exitCode = result.status === 'PASS' ? 0 : 1;
