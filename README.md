# Tailor – Recruiter Outreach Assistant

A Chrome extension that turns a LinkedIn profile into sharp, personal outreach openers in one click.

---

## Project layout

```
├── extension/          Chrome MV3 extension
│   ├── manifest.json
│   ├── content.js      Injects button + reads LinkedIn DOM
│   ├── background.js   Service worker – opens side panel
│   ├── sidepanel.html  Side panel UI
│   ├── sidepanel.css
│   └── sidepanel.js    UI logic – calls backend, renders variants
└── backend/            Vercel serverless function (holds the API key)
    ├── api/
    │   └── draft.js    POST /api/draft → Claude → JSON variants
    ├── package.json
    ├── vercel.json
    └── .env.example
```

---

## Quick start

### 1. Backend (local dev)

```bash
cd backend
npm install
cp .env.example .env          # add your ANTHROPIC_API_KEY
npm run dev                   # starts on http://localhost:3001
```

Requires [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`.

### 2. Load the extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. Navigate to any `linkedin.com/in/…` profile
5. Click the **Draft Outreach** button (bottom-right of the page)

### 3. Configure backend URL (first time)

The side panel defaults to `http://localhost:3001` for local dev.
To point it at your deployed Vercel URL, open the **Settings** section
at the bottom of the side panel and paste your URL there.

---

## Deploy backend to Vercel

```bash
cd backend
vercel                        # follow prompts
vercel env add ANTHROPIC_API_KEY   # add your key as a secret
vercel --prod
```

Your endpoint will be `https://<project>.vercel.app/api/draft`.
Paste that URL into the extension's Settings panel.

---

## Iteration notes

The quality of the output is the whole product.
Spend most of your time tweaking the system prompt in `backend/api/draft.js`.
The key constraints from the spec:
- Lead with something specific, not the job title
- Under 90 words per opener
- No flattery clichés
- 3 distinct variants with a one-line "hook" rationale

---

## v1 roadmap (post-validation)

- Supabase Auth (magic-link email)
- Free tier metering (5 drafts/day) via usage table
- Payments via ExtensionPay or Stripe
- Voice training: paste 2-3 past messages → used as style examples
- Saved snippets / reusable hooks
- Fit-to-JD mode: highlights candidate match/gaps vs job description
