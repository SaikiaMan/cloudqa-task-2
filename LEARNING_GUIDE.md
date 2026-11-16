# How to understand the whole project

Study in this order. You do not need to train an AI model.

1. **JavaScript fundamentals:** objects, arrays, functions, imports/exports, template literals, exceptions. Exercise: add a CLI option that changes the report output directory. Read `src/cli.js`.
2. **Node.js and npm:** package.json, package-lock.json, dependencies, scripts, environment variables, file I/O, command-line arguments. Exercise: run `npm test` and explain why `.env` and `node_modules` are gitignored.
3. **Asynchronous programming:** promises, async/await, try/catch/finally, timeouts. Exercise: trace why the browser closes even when a model request fails.
4. **HTML and accessibility:** forms, labels, roles, accessible names, CSS selectors, DOM. Exercise: inspect a login form and identify its textbox names without using CSS classes.
5. **Playwright:** browser/context/page, locators, strict matching, auto-waiting, navigation, assertions, screenshots, recording. Read `locator()` and the action dispatch in `src/runner.js`. Exercise: add an `uncheck` action to both the executor and model instructions.
6. **HTTP APIs and JSON:** POST requests, headers, Gemini API key headers, response status, JSON parsing, fetch. Read `src/model.js`. Exercise: explain the difference between an invalid API key and a failed website assertion.
7. **LLM agents:** prompting, observation/action loops, bounded tools, structured outputs, hallucinations, prompt injection, context limits. Exercise: explain why the model cannot execute arbitrary JavaScript and why successful assertions can still be insufficient.
8. **Testing:** positive/negative cases, unit vs integration vs live end-to-end tests, test oracles, reproducibility. Read `scripts/demo.js`. Exercise: change the fixture so login fails and confirm the positive test becomes FAIL.
9. **Git and delivery:** staging, commits, remotes, pushing, README quality, protecting secrets. Exercise: create your repository and reproduce setup in a fresh folder.

## Trace one run

`npm start` loads `.env` → CLI reads URL and English test → Gemini Flash client is configured → Chromium opens → accessibility snapshot describes the page → model returns a JSON action → Playwright executes it → result enters history → repeat → Playwright checks expected state → agent finishes → report/video are saved → process exits with PASS/FAIL code.

The AI translates intent into small decisions; Playwright performs browser operations and verifies concrete conditions. The runner contains no PHPTravels-specific behavior. Site-specific expectations belong in the test text and optional credentials.

Suggested practice: first run the local demo, then write your own Playwright test without AI, then inspect a real model action log. Finally try an unseen website and deliberately failing expectation.

## Generalization architecture

Read `src/browser-state.js` for observations and goals, `src/actions.js` for the restricted JSON protocol, then the runner. The CLI enables required planning. Element refs are temporary handles to observed selectors in the correct frame, regenerated every turn. Goal evidence survives short model history; each verified assertion links to its screenshot and page URL. Repeating a failed goal cannot be hidden by passing another goal. `scripts/general-regression.js` distinguishes scripted executor verification from real AI planning via `--ai`.
