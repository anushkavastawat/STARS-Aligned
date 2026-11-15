# Put STARS Aligned online for your hackathon

Your localhost link works on your Mac. A hosted Node service gives students and judges a public HTTPS link that works while your laptop is closed. The app has been prepared for Render, but this package does not create accounts, publish a repository or deploy a service for you.

## 1. Create a public GitHub repository

1. Sign in at https://github.com/new . Name the repository `stars-aligned` and choose Public, as required by the event information.
2. Use **uploading an existing file**, or **Add file → Upload files**.
3. Upload the contents of the extracted `stars-ai` folder: `package.json`, `server.mjs`, `report-schema.mjs`, the `public` and `test` folders and the README/deployment documents. Include `.gitignore` and `.env.example` if visible. Keep `package.json` at the repository root.
4. Do not upload your actual `.env`, `node_modules`, report PDFs or previous backup files. Upload from this clean package to avoid including local student data or secrets. Never paste the Gemini key into repository files or the README.
5. Commit the files. Your repository URL is the code link for Devpost. If GitHub suggests adding a README, use the one provided here.

## 2. Create a Render web service

1. Sign in at https://dashboard.render.com . Connect your GitHub account when asked.
2. Select **New → Web Service** and connect the `stars-aligned` repository.
3. Use these settings:

| Setting | Value |
| --- | --- |
| Runtime/language | Node |
| Root directory | Leave blank when package.json is at repository root |
| Build command | `npm install` |
| Start command | `npm start` |
| Instance type | Free |

Choose the Free instance explicitly. Render has bandwidth, build and runtime limits; this is a prototype deployment, not a promise of unlimited free hosting. A free service sleeps after 15 minutes without inbound traffic and can take about one minute to wake.

## 3. Add private environment variables in Render

Do this in the service's environment/secret settings, not in GitHub:

| Name | Value |
| --- | --- |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` |
| `GEMINI_API_KEY` | Your full private Gemini key |
| `APP_PASSWORD` | A demo access code you choose for students/judges |
| `NODE_VERSION` | `24.22.3` |

The demo access code is not your Gemini key. Visitors enter the demo code at the report review step. The sample walkthrough remains accessible without calling AI.

Render supplies `PORT`, `RENDER` and `RENDER_EXTERNAL_URL`. This version automatically binds publicly on Render and uses its external HTTPS URL for origin checks. You do not need to edit the server or set PUBLIC_ORIGIN for the normal onrender.com address. If using a custom domain or another host, set `HOST=0.0.0.0` and `PUBLIC_ORIGIN` to that exact public HTTPS origin, and keep APP_PASSWORD configured.

## 4. Deploy and test the public link

1. Deploy the service. Read the build logs if it fails; do not paste secret values when sharing logs.
2. Open the `https://...onrender.com` address Render gives you. This is the app link to share, not your local 127.0.0.1 address.
3. Test in a private/incognito browser window: the sample walkthrough, an anonymized report upload, the access code, the dashboard, term selection and the advisor email copy buttons.
4. Confirm you can open the link from your phone with your laptop's local server stopped. A deployment is not verified until its public flow works.
5. Share the app link and demo access code with reviewers. All live decodes use your server's key and share that project's Gemini quota. Free hosting and Gemini availability can both affect the demo.

## 5. Devpost links and supporting materials

Based on the event requirements you provided, include:

- The public Render app link and demo access code in reviewer instructions.
- The public GitHub repository link.
- Project description: student problem, solution, AI use, stack, challenges and future campus implementation.
- A walkthrough video no longer than 3 minutes.
- A short pitch slide deck.
- At least one screenshot using synthetic/anonymized data.

Open the hosted link shortly before your live presentation to allow the service to wake. Also record your working flow for the required video; do not rely solely on an external provider being available at judging time.

Official hosting references:
- https://render.com/docs/free
- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/environment-variables
