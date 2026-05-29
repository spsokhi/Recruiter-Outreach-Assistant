// Tailor – content script
// Injects the "Draft Outreach" button on LinkedIn profile pages and reads the DOM.

const BUTTON_ID = 'tailor-draft-btn';

// ── Button injection ──────────────────────────────────────────────────────────

function injectButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
         style="vertical-align:-2px;margin-right:6px">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>Draft Outreach`;
  btn.style.cssText = `
    position:fixed;bottom:28px;right:28px;z-index:2147483647;
    background:#0a66c2;color:#fff;border:none;border-radius:24px;
    padding:11px 18px;font-size:13px;font-weight:600;cursor:pointer;
    box-shadow:0 4px 14px rgba(10,102,194,0.45);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    letter-spacing:0.01em;transition:transform 0.15s ease,box-shadow 0.15s ease;
    display:flex;align-items:center;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 7px 20px rgba(10,102,194,0.55)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = '';
    btn.style.boxShadow = '0 4px 14px rgba(10,102,194,0.45)';
  });
  btn.addEventListener('click', handleClick);

  document.body.appendChild(btn);
}

// ── Profile DOM extraction ────────────────────────────────────────────────────

function extractProfile() {
  // Name — try DOM selectors first, then fall back to page title
  // LinkedIn page titles are: "(1) Satya Nadella | LinkedIn" or "Satya Nadella | LinkedIn"
  const nameFromTitle = document.title
    .replace(/^\(\d+\)\s*/, '')   // strip unread count "(1) "
    .split(' | ')[0]
    .trim();

  const name = (
    document.querySelector('h1.text-heading-xlarge') ||
    document.querySelector('.artdeco-entity-lockup__title h1') ||
    document.querySelector('h1')
  )?.innerText?.trim() || nameFromTitle;

  // Headline
  const headline = (
    document.querySelector('.text-body-medium.break-words') ||
    document.querySelector('.artdeco-entity-lockup__subtitle span') ||
    document.querySelector('[data-field="headline"]')
  )?.innerText?.trim() || '';

  // Location
  const location = (
    document.querySelector('.text-body-small.inline.t-black--light.break-words') ||
    document.querySelector('[data-field="location_name"]')
  )?.innerText?.trim() || '';

  // About – LinkedIn truncates with "see more"; the full text sits in a sibling span
  let about = '';
  const aboutAnchor = document.getElementById('about');
  if (aboutAnchor) {
    const section = aboutAnchor.closest('section') || aboutAnchor.parentElement?.parentElement;
    if (section) {
      const full = section.querySelector('span[aria-hidden="true"]') ||
                   section.querySelector('.visually-hidden') ||
                   section;
      about = full.innerText?.replace(/^About\s*/i, '').trim().slice(0, 1200) || '';
    }
  }

  // Experience
  let experience = '';
  const expAnchor = document.getElementById('experience');
  if (expAnchor) {
    const section = expAnchor.closest('section') || expAnchor.parentElement?.parentElement;
    if (section) {
      experience = section.innerText?.replace(/^Experience\s*/i, '').trim().slice(0, 1500) || '';
    }
  }

  // Education
  let education = '';
  const eduAnchor = document.getElementById('education');
  if (eduAnchor) {
    const section = eduAnchor.closest('section') || eduAnchor.parentElement?.parentElement;
    if (section) {
      education = section.innerText?.replace(/^Education\s*/i, '').trim().slice(0, 600) || '';
    }
  }

  // Fallback: pull text from main if we got nothing useful
  if (!headline && !experience && !about) {
    const main = document.querySelector('main');
    if (main) experience = main.innerText.trim().slice(0, 3000);
  }

  return { name, headline, location, about, experience, education, url: window.location.href };
}

// ── Click handler ─────────────────────────────────────────────────────────────

function handleClick() {
  const btn = document.getElementById(BUTTON_ID);
  if (btn) {
    btn.textContent = 'Reading profile…';
    btn.disabled = true;
    btn.style.opacity = '0.75';
  }

  const profile = extractProfile();

  chrome.runtime.sendMessage({ type: 'OPEN_PANEL', profile }, () => {
    // Restore button after a short delay
    setTimeout(() => {
      if (btn) {
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
               style="vertical-align:-2px;margin-right:6px">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
          </svg>Draft Outreach`;
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }, 1500);
  });
}

// ── Init + SPA navigation watch ───────────────────────────────────────────────

function init() {
  if (window.location.pathname.match(/^\/in\//)) injectButton();
}

init();

// LinkedIn is a SPA – re-inject when the URL changes
let lastHref = location.href;
new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    const existing = document.getElementById(BUTTON_ID);
    if (existing) existing.remove();
    setTimeout(init, 800); // wait for the new page shell to render
  }
}).observe(document.body, { childList: true, subtree: true });
