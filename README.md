# STARS Aligned

A student-built USC hackathon prototype that turns STARS report text into a consistent degree dashboard and a tentative semester plan. It is an independent planning aid, not an official USC service or degree audit.

## Run locally

Use Node.js 24. Open Terminal in this folder, then run:

```bash
npm install
cp .env.example .env
open -e .env
```

In `.env`, set `AI_PROVIDER=gemini` and put your private Gemini key after `GEMINI_API_KEY=`. Keep `GEMINI_MODEL=gemini-3.5-flash-lite`. Leave `APP_PASSWORD` blank for local-only use. Existing users should keep their current `.env`; do not overwrite it with the example.

```bash
npm start
```

Open http://127.0.0.1:3000 . Keep Terminal running. Press Control+C to stop. To restart, run `npm start` in this folder. Opening the HTML directly does not start the backend.

## Student flow

1. Choose a PDF, or paste report text as a fallback.
2. PDF.js reads the PDF in the browser. Common identifier patterns are removed from the text. Cleanup can miss details: inspect the read-only preview and go back to use an anonymized copy if needed.
3. Confirm consent and click Decode. Only then does reviewed text go through the Node server to the selected AI provider. The original PDF is not sent to the provider.
4. The server validates the structured response, checks source evidence, reads explicitly labeled GPA blocks and flags uncertain facts. Validation does not guarantee academic accuracy.
5. Review progress, remaining requirements and completed courses. Tracks are alternatives; reports with no tracks get a direct requirements/planning path.
6. Build a tentative semester shortlist through the report's expected graduation term. Registered coursework stays separate from additions.
7. Click **Draft email to advisor**, personalize the subject and message, and copy them into an email. Drafting and copying use no additional AI request. The app does not send email.

The prepared sample is a separate demonstration. Provider failures never silently substitute sample data. The AI fills a fixed data schema; it does not generate the page layout.

## Share and submit

See **DEPLOY.md** for GitHub + Render setup. GitHub stores the code; a Node web service runs the app and holds the API key privately. GitHub Pages alone cannot run this server.

This project archive contains no real API keys or student report. Never add your actual `.env`, downloaded reports or `node_modules` to a public repository. Only `.env.example` is a shareable configuration template.

For the hackathon, submit your live app URL and public GitHub repository, plus the description, video, slide deck and screenshot required by the event. Put the demo access code in the reviewer instructions so judges can decode synthetic/anonymized reports. Provide a prepared-sample walkthrough in the video as a fallback if external AI services are unavailable.

## Data and limits

- The app does not write submitted PDFs, report text or AI results to disk or log report content. Reports, plans and email drafts stay in page/server memory. Refreshing the page clears the working dashboard and draft. Copying an email places the selected text on the student's clipboard.
- The selected AI provider receives reviewed text. Google's free tier may use submitted content for product improvement. Do not describe this app as guaranteeing anonymity or zero provider retention. Use synthetic or anonymized reports and permission from their owner.
- Redaction and decoding are imperfect. Missing terms remain unknown rather than guessed. Scanned/image-only PDFs need pasted text; OCR is not included.
- Saved USC references cover ten course-unit listings and eight prerequisite-course lists from the CECS sample. They are not live term availability or a complete course catalogue. Other courses may have unknown units/prerequisites. Minimum grades, co-requisites, waivers and registration clearance need confirmation.
- Current/pending coursework is not earned credit. A unit gap does not replace specific course requirements. The source report's prepared date controls its current/registered interpretation.
- The default local bind is 127.0.0.1. Public binding requires `APP_PASSWORD`. The server checks origin, body size, two concurrent decodes and a small in-memory 20-attempt/hour/IP limit. A hosting proxy may make visitors share that limit. All live visitors share the configured provider project's quota.
- Render's free service can sleep after inactivity and has usage limits. It is suitable for a small prototype demonstration, not production campus adoption.

## Stack and verification

Node.js HTTP server, browser JavaScript/HTML/CSS, PDF.js 6.5.438, Gemini native structured JSON generation (with an optional OpenAI backend), deterministic source checks and saved USC references. No database is required.

Run `npm test`. The local suite uses synthetic provider responses and a DOM contract harness; it is not a visual browser test or a real-provider accuracy evaluation. The developer checked the supplied sample report's three GPA blocks. Evaluate academic results with real user/advisor review before broader use.
