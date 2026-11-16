# Five-minute submission walkthrough

The runner saves browser-only `.webm` recordings. These are evidence of browser activity, not a narrated five-minute screen recording. Record your desktop with Windows Snipping Tool, Xbox Game Bar, or OBS and use this outline after configuring a Gemini API key and enabling RECORD_VIDEO=true if browser video is needed.

- **0:00–0:40:** explain the input (URL + English test), PASS/FAIL output, and no hard-coded site flow. Show README setup and `.env.example`; never show the real `.env`.
- **0:40–1:40:** run the PHPTravels visibility command from README with `--headed`. Show the browser and generated report. If demo access is available, also show customer login using credential placeholders.
- **1:40–2:30:** run the Example Domain test to demonstrate another website without code changes.
- **2:30–3:15:** run a deliberately wrong expectation, such as an Example Domain heading named `Customer dashboard`, and show FAIL and its reason.
- **3:15–4:20:** show `model.js` and `runner.js`; explain snapshot → JSON action → Playwright → assertion, bounded steps, and reports.
- **4:20–5:00:** mention model fallibility, API key requirement, CAPTCHA/iframe limits, and private artifacts. Show the learning guide and repository URL.

Do not represent the scripted integration demo as an AI-driven run. A live model demonstration must use `npm start` with a configured key.
