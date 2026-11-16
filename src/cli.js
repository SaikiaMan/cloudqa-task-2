import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { createModel } from './model.js';
import { runTest } from './runner.js';

try {
  const { values: v } = parseArgs({ options: {
    url: { type: 'string' }, test: { type: 'string' }, 'test-file': { type: 'string' },
    headed: { type: 'boolean', default: false }, 'max-steps': { type: 'string', default: '30' },
    'allow-origin': { type: 'string', multiple: true }, output: { type: 'string', default: 'reports' },
    help: { type: 'boolean' }
  } });
  if (v.help) {
    console.log('npm start -- --url https://example.com --test "Verify the heading is visible" [--headed] [--test-file case.txt] [--allow-origin https://other.com] [--max-steps 30]');
  } else {
    const test = v['test-file'] ? (await readFile(v['test-file'], 'utf8')).trim() : v.test;
    if (!v.url || !test) throw new Error('--url and --test (or --test-file) are required');
    if (!['http:', 'https:'].includes(new URL(v.url).protocol)) throw new Error('URL must use HTTP(S)');
    const maxSteps = Number(v['max-steps']);
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 100) throw new Error('--max-steps must be 1–100');
    const credentials = Object.fromEntries(Object.entries(process.env).filter(([k,v]) => k.startsWith('TEST_') && v));
    const result = await runTest({ url: v.url, test, decide: createModel(), headed: v.headed,
      maxSteps, requirePlan: true, output: v.output, allowedOrigins: v['allow-origin'] || [], credentials });
    console.log(`${result.status}: ${result.reason}\nReport: ${result.directory}`);
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 2; }
