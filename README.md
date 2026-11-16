# Plain-English Browser QA - CloudQA Task 2

A Node.js CLI that takes a website URL and a plain-English test, lets Gemini inspect the page and choose actions, then uses Playwright to execute browser assertions and report PASS or FAIL.

The core runner contains no PHPTravels selectors or predetermined login/search flows. New tests and websites use the same CLI. Site-specific diagnostic scripts are separate from the AI runner.

## Quick start

Requires Node.js 22+ and a Gemini API key from [Google AI Studio](https://aistudio.google.com/api-keys).

```powershell
git clone https://github.com/SaikiaMan/cloudqa-task-2.git
cd cloudqa-task-2
npm ci
Copy-Item .env.example .env
```

Edit `.env` locally:

```dotenv
GEMINI_API_KEY=your_actual_key
GEMINI_MODEL=gemini-3.5-flash-lite
BROWSER_CHANNEL=msedge
RECORD_VIDEO=false
GEMINI_TIMEOUT_MS=120000
```

The template uses installed Microsoft Edge. If Edge is unavailable, run `npx playwright install chromium` and leave `BROWSER_CHANNEL` blank to use bundled Chromium. Copy the template only during first setup so an existing key is not overwritten.

```powershell
npm start -- --url https://example.com --test "Verify the Learn more link is visible" --headed
```

`--headed` makes the browser visible. Omit it for headless execution. Website content changes; expected outcomes must match the current page.

## PHPTravels and unseen websites

```powershell
npm start -- --url https://phptravels.com/demo --test "Verify the demo access section is visible" --headed
npm start -- --url https://your-test-site.example --test-file case.txt --max-steps 50 --headed
```

For customer login, obtain legitimate demo access manually and use the actual customer URL supplied by PHPTravels. Put credentials in the private `.env` file:

```dotenv
TEST_EMAIL=your_test_email
TEST_PASSWORD=your_test_password
```

```powershell
npm start -- --url https://phptravels.net --test "Log in using {{TEST_EMAIL}} and {{TEST_PASSWORD}} and verify the customer dashboard is shown" --headed
```

Any nonempty `TEST_` environment variable is available as a local credential placeholder. Missing personal details and security challenges are reported as blockers rather than fabricated or bypassed. Customer login and signup have not been verified end to end; see [VALIDATION.md](VALIDATION.md).

To permit an authentication redirect to another origin, add `--allow-origin https://auth.example.com`. Multiple `--allow-origin` flags are supported. The starting origin is allowed automatically. This guards document navigation, not every network request; use authorized test environments.

## How it works

1. Inspect the page title, accessibility snapshot, visible controls, allowed frames, tabs, and changes since the last observation.
2. Ask Gemini to plan goals covering the requested outcomes.
3. Receive one action using a restricted JSON schema. Targets can use current observed element references or accessible locators.
4. Execute the action with Playwright, wait for dynamic DOM changes, and return any errors to Gemini for recovery.
5. Require successful browser assertions for every planned goal before allowing PASS.

Element references are unique to each observation. Stale references are rejected rather than silently targeting another control. Native dropdowns accept values or labels. Custom pickers use click, fill, wait, selection, and verification. Read-only dates use calendar interaction. The runner also supports hover, scroll, checkbox actions, iframe controls, and tab switching.

A failed goal cannot be cleared by an unrelated goal's successful assertion. Altering a verified goal invalidates its verification until it is checked again. The AI still chooses the plan and assertion meaning, so incomplete plans or weak assertions remain possible; review the evidence.

### Source layout

| File | Responsibility |
| --- | --- |
| `src/cli.js` | Arguments, environment, credentials, exit codes |
| `src/model.js` | Gemini requests, planning prompt, provider errors and correction attempt |
| `src/actions.js` | JSON action schema and validation |
| `src/browser-state.js` | Generic observations, element refs, goal and failure tracking |
| `src/runner.js` | Browser action loop, assertions, screenshots and reports |

## Results

Each run creates `reports/<unique-run>/` with:

- `report.json`: goals, actions, errors, assertion evidence, and final outcome.
- `report.html`: readable report linking to the final screenshot.
- `final.png`, `assertion-*.png`, and `error-*.png` when available.
- Optional browser video under `video/` when recording is enabled.

Exit codes: **0 PASS**, **1 FAIL**, **2 configuration/CLI error**. Provider quota, browser launch, and network errors produce FAIL with an explanation; they are not evidence that the target application is defective.

To enable video, install the encoder with `npx playwright install ffmpeg` and set `RECORD_VIDEO=true`. Text reports redact configured credentials, but screenshots and recordings can contain private page data. Reports and `.env` are gitignored.

## Verification commands

| Command | What it checks | Requires Gemini key? |
| --- | --- | --- |
| `npm test` | Unit tests for actions, model responses, goals, errors, and stale refs | No |
| `npm run demo` | Scripted local login PASS and expected FAIL | No |
| `npm run test:autocomplete` | Delayed custom suggestions and hidden duplicate text | No |
| `npm run test:general` | Scripted six-goal flow with randomized controls, iframe and popup | No |
| `npm run test:ai -- --headed` | Live AI login, preferences and negative case on local fixture | Yes |
| `npm run test:general:ai -- --headed` | Live AI on the new equipment-rental workflow | Yes |
| `npm run smoke` | Scripted live PHPTravels access-heading check | No |
| `npm run test:flights` | Scripted live PHPTravels route/date/results check | No |

Scripted tests verify the executor, not AI understanding. `test:flights` uses fixed November 19-21, 2026 dates and must be updated for later runs; it never books. External smoke checks depend on live site availability. The generic CLI does not invoke these scripts or import their site-specific selectors.

See [VALIDATION.md](VALIDATION.md) for observed results, [LEARNING_GUIDE.md](LEARNING_GUIDE.md) for an architecture walkthrough, and [RECORDING.md](RECORDING.md) for a demonstration outline.

## Practical limits

- There is no guarantee of support for every website or unseen workflow.
- No CAPTCHA bypass, file upload/download workflow, visual reasoning, or closed-shadow-root support.
- Observations are limited to 18,000 snapshot characters and 240 element records per allowed frame. Large or highly dynamic pages may require more steps or fail.
- Browser operations have bounded timeouts. CLI step budget is 1-100, default 30.
- Gemini request timeout defaults to 120 seconds, configurable with `GEMINI_TIMEOUT_MS` (1000-300000). Temporary HTTP 500/502/503/504 responses get two retries with 2/4-second delays. Invalid actions get one correction request. Quota/authentication/timeouts are not automatically retried.
- Gemini free-tier eligibility and quotas depend on the account; HTTP 429 and 503 can prevent completion. Paid projects can incur charges. See [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).
- Page observations are sent to Google. The navigation guard and instructions are not a complete prompt-injection or network security sandbox.

References: [Playwright locators](https://playwright.dev/docs/locators), [assertions](https://playwright.dev/docs/test-assertions), [Gemini generateContent](https://ai.google.dev/api/generate-content).
