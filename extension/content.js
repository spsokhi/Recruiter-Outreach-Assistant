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

// ── Auto-scroll to trigger LinkedIn lazy loading ───────────────────────────────

function scrollToReveal() {
  return new Promise((resolve) => {
    const totalHeight = document.body.scrollHeight;
    const step = 600;
    let current = 0;

    const timer = setInterval(() => {
      window.scrollBy(0, step);
      current += step;
      if (current >= totalHeight) {
        clearInterval(timer);
        // Scroll back to top then resolve
        window.scrollTo({ top: 0, behavior: 'instant' });
        setTimeout(resolve, 400);
      }
    }, 80);
  });
}

// ── Profile DOM extraction ────────────────────────────────────────────────────

function extractProfile() {
  // Name — try DOM selectors, fall back to page title
  const nameFromTitle = document.title
    .replace(/^\(\d+\)\s*/, '')
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

  // About
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
      experience = section.innerText?.replace(/^Experience\s*/i, '').trim().slice(0, 2000) || '';
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

  // Skills
  let skills = '';
  const skillsAnchor = document.getElementById('skills');
  if (skillsAnchor) {
    const section = skillsAnchor.closest('section') || skillsAnchor.parentElement?.parentElement;
    if (section) {
      skills = section.innerText?.replace(/^Skills\s*/i, '').trim().slice(0, 400) || '';
    }
  }

  // Broad fallback: grab all main text if sections are empty
  const hasContent = about || experience || headline;
  if (!hasContent) {
    const main = document.querySelector('main');
    if (main) experience = main.innerText.trim().slice(0, 4000);
  }

  return { name, headline, location, about, experience, education, skills, url: window.location.href };
}

// ── Click handler ─────────────────────────────────────────────────────────────

async function handleClick() {
  const btn = document.getElementById(BUTTON_ID);
  if (btn) {
    btn.textContent = 'Scanning profile…';
    btn.disabled = true;
    btn.style.opacity = '0.75';
  }

  // Scroll the page to force LinkedIn to render all lazy-loaded sections
  await scrollToReveal();

  const profile = extractProfile();

  // Guard: extension was reloaded but page wasn't refreshed
  if (!chrome?.runtime?.id) {
    alert('Tailor was updated — please refresh this page (F5) and try again.');
    if (btn) { btn.textContent = 'Refresh page'; btn.disabled = false; btn.style.opacity = '1'; }
    return;
  }

  chrome.runtime.sendMessage({ type: 'OPEN_PANEL', profile }, () => {
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

let lastHref = location.href;
new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    const existing = document.getElementById(BUTTON_ID);
    if (existing) existing.remove();
    setTimeout(init, 800);
  }
}).observe(document.body, { childList: true, subtree: true });
