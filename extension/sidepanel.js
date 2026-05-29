// Tailor – side panel logic

const DEFAULT_BACKEND = 'https://recruiter-outreach-assistant.vercel.app';

// ── State ─────────────────────────────────────────────────────────────────────

let currentProfile = null;
let backendUrl = DEFAULT_BACKEND;

// ── DOM refs ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const profileSection  = $('profile-section');
const emptyState      = $('empty-state');
const draftForm       = $('draft-form');
const loadingEl       = $('loading');
const errorBox        = $('error-box');
const errorMsg        = $('error-msg');
const errorDismiss    = $('error-dismiss');
const resultsEl       = $('results');
const variantsList    = $('variants-list');
const resultsName     = $('results-name');
const redraftBtn      = $('redraft-btn');
const draftBtn        = $('draft-btn');
const backendInput    = $('backend-url-input');
const saveUrlBtn      = $('save-url-btn');

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  // Load saved backend URL
  chrome.storage.local.get(['backendUrl'], (data) => {
    backendUrl = data.backendUrl || DEFAULT_BACKEND;
    backendInput.value = backendUrl;
  });

  // Load profile from session storage
  chrome.storage.session.get(['profile'], (data) => {
    if (data.profile) setProfile(data.profile);
    else showEmpty();
  });

  // Listen for profile updates while the panel is open
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.profile) {
      const profile = changes.profile.newValue;
      if (profile) setProfile(profile);
    }
  });
}

// ── Profile display ───────────────────────────────────────────────────────────

function setProfile(profile) {
  currentProfile = profile;

  // Avatar initials
  const initials = (profile.name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  $('profile-avatar').textContent = initials;
  $('profile-name').textContent = profile.name || 'Unknown';
  $('profile-headline').textContent = profile.headline || profile.url || '';

  profileSection.classList.remove('hidden');
  emptyState.classList.add('hidden');
  draftForm.classList.remove('hidden');
  resultsEl.classList.add('hidden');
  loadingEl.classList.add('hidden');
  errorBox.classList.add('hidden');
}

function showEmpty() {
  emptyState.classList.remove('hidden');
  profileSection.classList.add('hidden');
  draftForm.classList.add('hidden');
}

// ── Format profile for the prompt ─────────────────────────────────────────────

function formatProfile(p) {
  const parts = [];
  if (p.name)       parts.push(`Name: ${p.name}`);
  if (p.headline)   parts.push(`Headline: ${p.headline}`);
  if (p.location)   parts.push(`Location: ${p.location}`);
  if (p.about)      parts.push(`About:\n${p.about}`);
  if (p.experience) parts.push(`Experience:\n${p.experience}`);
  if (p.education)  parts.push(`Education:\n${p.education}`);
  return parts.join('\n\n');
}

// ── Draft call ────────────────────────────────────────────────────────────────

async function draftOpeners({ role, tone, goal }) {
  const profileText = formatProfile(currentProfile);

  const res = await fetch(`${backendUrl}/api/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileText, role, tone, goal }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Backend error ${res.status}: ${body || res.statusText}`);
  }

  const data = await res.json();
  if (!Array.isArray(data.variants)) throw new Error('Unexpected response format from backend.');
  return data.variants;
}

// ── Render results ────────────────────────────────────────────────────────────

function renderVariants(variants) {
  variantsList.innerHTML = '';

  variants.forEach((v, i) => {
    const card = document.createElement('div');
    card.className = 'variant-card';

    const opener = (v.opener || '').trim();
    const why    = (v.why    || '').trim();

    card.innerHTML = `
      <div class="variant-card-header">
        <span class="variant-label">Option ${i + 1}</span>
        <button class="copy-btn" data-index="${i}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>
      <textarea class="variant-opener" rows="4" spellcheck="true">${escapeHtml(opener)}</textarea>
      ${why ? `<div class="variant-why">${escapeHtml(why)}</div>` : ''}
    `;

    // Copy button
    card.querySelector('.copy-btn').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const text = card.querySelector('.variant-opener').value;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>Copy`;
          btn.classList.remove('copied');
        }, 2000);
      });
    });

    variantsList.appendChild(card);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Form submission ───────────────────────────────────────────────────────────

draftForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentProfile) return;

  const role = $('role-input').value.trim();
  const tone = document.querySelector('input[name="tone"]:checked')?.value || 'warm';
  const goal = document.querySelector('input[name="goal"]:checked')?.value || 'cold opener';

  // Show loading
  draftForm.classList.add('hidden');
  resultsEl.classList.add('hidden');
  errorBox.classList.add('hidden');
  loadingEl.classList.remove('hidden');

  try {
    const variants = await draftOpeners({ role, tone, goal });

    loadingEl.classList.add('hidden');
    resultsName.textContent = currentProfile.name || 'candidate';
    renderVariants(variants);
    resultsEl.classList.remove('hidden');
  } catch (err) {
    loadingEl.classList.add('hidden');
    errorMsg.textContent = ` ${err.message}`;
    errorBox.classList.remove('hidden');
    draftForm.classList.remove('hidden');
  }
});

// ── Redraft / dismiss ─────────────────────────────────────────────────────────

redraftBtn.addEventListener('click', () => {
  resultsEl.classList.add('hidden');
  draftForm.classList.remove('hidden');
});

errorDismiss.addEventListener('click', () => {
  errorBox.classList.add('hidden');
});

// ── Settings ──────────────────────────────────────────────────────────────────

saveUrlBtn.addEventListener('click', () => {
  const url = backendInput.value.trim().replace(/\/$/, '');
  if (!url) return;
  backendUrl = url;
  chrome.storage.local.set({ backendUrl: url }, () => {
    saveUrlBtn.textContent = 'Saved ✓';
    setTimeout(() => { saveUrlBtn.textContent = 'Save'; }, 1500);
  });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

init();
