// Local dev server – no Vercel account needed.
// Run: node server.js

import http from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Load .env ─────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
try {
  readFileSync(join(__dir, '.env'), 'utf8')
    .split('\n')
    .forEach((line) => {
      const eq = line.indexOf('=');
      if (eq > 0) process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    });
} catch { /* .env optional */ }

// ── Groq setup ────────────────────────────────────────────────────────────────

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You write short, genuinely personal recruiter outreach openers.
You are the opposite of generic AI outreach. Rules:
- Lead with something SPECIFIC about this person's actual work or trajectory — never their job title alone.
- Connect their background to the concrete challenge of the role.
- Use a mutual or shared context only if it is clearly present in the profile; never invent one.
- No flattery clichés ("impressive background", "I came across your profile", "hope this finds you well").
- Sound like a human who spent 30 seconds of real homework on this person — not a template.
- Each opener must be under 90 words.
- Return ONLY a JSON object in this exact shape: {"variants":[{"opener":"...","why":"..."},{"opener":"...","why":"..."},{"opener":"...","why":"..."}]}
  where "why" is one sentence naming the specific hook used. No extra text outside the JSON.`;

const toneMap = {
  warm:   'Warm, human, and collegial tone.',
  direct: 'Direct and to-the-point — no fluff.',
  casual: 'Casual, conversational — like a peer reaching out.',
};
const goalMap = {
  'cold opener': 'Goal: first cold contact to start a conversation.',
  'follow-up':   'Goal: follow-up to a previous outreach that went unanswered.',
  'InMail':      'Goal: LinkedIn InMail — slightly more formal.',
};

async function draft({ profileText, role, tone, goal }) {
  const userPrompt = `CANDIDATE PROFILE:
${profileText || '(No profile data provided)'}

ROLE / CONTEXT:
${role || '(No role details provided)'}

TONE: ${toneMap[tone] || toneMap.warm}
GOAL: ${goalMap[goal] || goalMap['cold opener']}

Write 3 distinct openers. Return JSON only.`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  const data = await res.json();
  const raw  = data.choices[0].message.content;
  const parsed = JSON.parse(raw);

  // Accept both {"variants":[...]} and a bare array [...]
  const list = Array.isArray(parsed) ? parsed : (parsed.variants || []);
  if (!list.length) throw new Error('Model returned empty variants.');

  return list
    .map((v) => ({
      opener: String(v.opener || v.message || v.text || '').trim(),
      why:    String(v.why    || v.hook   || v.rationale || '').trim(),
    }))
    .filter((v) => v.opener);
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PORT = 3001;

http.createServer(async (req, res) => {
  const path = req.url.split('?')[0].replace(/\/$/, '');
  console.log(`→ ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
    return res.end(JSON.stringify({ ok: true, message: 'Tailor backend is running.' }));
  }

  if (req.method !== 'POST' || path !== '/api/draft') {
    res.writeHead(404, { 'Content-Type': 'application/json', ...CORS });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    try {
      const payload  = JSON.parse(body || '{}');
      const variants = await draft(payload);
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ variants }));
    } catch (err) {
      console.error('[/api/draft]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}).listen(PORT, () => {
  console.log(`Tailor backend running → http://localhost:${PORT}/api/draft`);
  console.log(`GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✓ loaded' : '✗ MISSING – check .env'}`);
});
