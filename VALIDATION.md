# Validation

Final submission checks performed on 16 November 2026 on Windows, Node.js 26.12.1, Playwright 1.65.1, installed Microsoft Edge, with video disabled.

## Fresh-install checks

A clean copy containing only source, tests, scripts, package files and the empty environment template was created locally. It contained no private `.env`, existing dependencies, reports or cache. `npm ci` installed successfully from the lockfile and reported zero vulnerabilities.

| Check | Result |
| --- | --- |
| Unit tests (`npm test`) | 20 passed |
| CLI help | Passed |
| Missing API key | Expected configuration exit code 2 |
| Scripted local login | PASS |
| Scripted nonexistent dashboard heading | Expected FAIL; finish could not override it |
| Delayed autocomplete and hidden duplicate text | PASS, no action errors |
| Generic equipment-rental regression | PASS, all six goals verified, no action errors |
| Live PHPTravels demo-access heading | PASS |
| Final live Gemini Example Domain link test | PASS: plan, browser assertion, finish |

The equipment-rental regression covers randomized control IDs, a delayed custom picker, option selection by label, a read-only calendar, checkbox verification, saving text in an iframe, popup navigation and switching tabs. Its default decisions are scripted; use `npm run test:general:ai` for real Gemini decisions.

The final Example Domain run used the CLI, the configured Gemini key, and the real browser. Its `Learn more` assertion passed. A preceding final GitHub article recheck failed after provider errors and a missing AI assertion condition. The Gemini response schema was tightened to require condition, goal and reason fields; unit checks and the final live link check then passed.

## Other observed live checks during development

- Real Gemini identified the supplied GitHub Blog agent-skills article by verifying the page title and article heading. Both planned goals passed.
- Real Gemini filled the PHPTravels signup email/password fields. Registration was not submitted; missing personal details and an arithmetic security check blocked completion.
- Real Gemini selected Delhi DEL and Dibrugarh DIB through actual airport suggestions, with browser assertions on the closed picker controls.
- Direct Playwright selected DEL/DIB and November 19/21, 2026, submitted Search Flights, and verified the exact results URL and a visible round-trip flight card. This was a scripted diagnostic, not a completed AI flight workflow. No booking was made.
- A previous live AI local login/preferences/navigation flow passed, and a deliberately missing heading correctly failed.

## Remaining limits

Full AI execution of the new six-goal workflow and full PHPTravels flight search are not verified end to end. Attempts encountered Gemini quota limits, temporary service errors and planning/action mistakes. These are recorded as failures rather than fabricated passes.

No customer dashboard login, successful real signup, CAPTCHA completion, booking, purchase, video recording, or narrated walkthrough is claimed. The model chooses plan semantics and assertion strength; a passed test is not a guarantee of complete application correctness or universal website support.

## Publication audit

Only source, package/lock files, tests, example scripts, setup documentation and an empty `.env.example` are intended for Git. The private `.env`, reports/screenshots, dependencies, caches and clean-install verification copy are ignored. The intended files were scanned for configured private credentials and common token/private-key patterns. No matches were found.

Reports remain local and intentionally are not published. Each verification command regenerates its own reports. See the README for how scripted checks differ from real AI runs.
