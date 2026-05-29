// Tailor – /api/draft (Vercel Serverless Function)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.3-70b-versatile';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `You write short, genuinely personal recruiter outreach openers.
You are the opposite of generic AI outreach. Rules:
- Lead with something SPECIFIC about this person's actual work or trajectory — never their job title alone.
- Connect their background to the concrete challenge of the role.
- Use a mutual or shared context only if it is clearly present in the profile; never invent one.
- No flattery clichés ("impressive background", "I came across your profile", "hope this finds you well").
- Sound like a human who spent 30 seconds of real homework on this person — not a template.
- Each opener must be under 90 words.
- Return ONLY a JSON object: {"variants":[{"opener":"...","why":"..."},{"opener":"...","why":"..."},{"opener":"...","why":"..."}]}`;

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

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { profileText, role, tone, goal } = req.body || {};

  const userPrompt = `CANDIDATE PROFILE:
${profileText || '(No profile data provided)'}

ROLE / CONTEXT:
${role || '(No role details provided)'}

TONE: ${toneMap[tone] || toneMap.warm}
GOAL: ${goalMap[goal] || goalMap['cold opener']}

Write 3 distinct openers. Return JSON only.`;

  try {
    const groqRes = await fetch(GROQ_URL, {
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

    if (!groqRes.ok) throw new Error(await groqRes.text());

    const data   = await groqRes.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const list   = Array.isArray(parsed) ? parsed : (parsed.variants || []);

    const variants = list
      .map((v) => ({
        opener: String(v.opener || v.message || '').trim(),
        why:    String(v.why    || v.hook   || '').trim(),
      }))
      .filter((v) => v.opener);

    return res.status(200).json({ variants });
  } catch (err) {
    console.error('[/api/draft]', err);
    return res.status(500).json({ error: err.message });
  }
}
