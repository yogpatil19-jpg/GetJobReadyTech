/**
 * courses.js
 * ---------------------------------------------------------------------------
 * Course data, pricing-card rendering, and the settings-panel forms.
 * Logic preserved exactly from the original prototype — only the visual
 * markup classes changed, not the IDs, data keys, or storage calls.
 */

const STORAGE_KEY = 'kiwicraft-snowflake-courses-v1';

const defaultCourses = [
  {
    id: 'identity',
    stageId: 'SF-101 · IDENTITY & ACCESS',
    title: 'Snowflake Identity',
    desc: 'Placeholder description — replace in settings. Covers Snowflake\'s authentication model, roles, RBAC, and SSO fundamentals.',
    modules: ['Authentication methods', 'Role-based access control', 'SSO & federated identity', 'Security best practices'],
    fee: '199',
    currency: 'USD',
    paymentLink: '',
    stripePriceId: '',
    whatsapp: '',
    demoLink: '',
    showDemoButton: true,
    showEnrollButton: true,
    enabled: true
  },
  {
    id: 'developer',
    stageId: 'SF-201 · DEVELOPER STREAM',
    title: 'Snowflake Developer Stream',
    desc: 'Placeholder description — replace in settings. Hands-on track covering SQL, Snowpark, and building data applications.',
    modules: ['Core SQL & warehousing', 'Snowpark for app development', 'Data pipeline patterns', 'Deploying Snowflake apps'],
    fee: '249',
    currency: 'USD',
    paymentLink: '',
    stripePriceId: '',
    whatsapp: '',
    demoLink: '',
    showDemoButton: true,
    showEnrollButton: true,
    enabled: true
  }
];

let courses = [];

async function loadCourses() {
  try {
    const res = await window.storage.get(STORAGE_KEY, true);
    courses = res && res.value ? JSON.parse(res.value) : defaultCourses;
  } catch (e) {
    console.warn('[courses] Falling back to defaultCourses — Firestore read failed:', e);
    courses = defaultCourses;
  }
  renderCourses();
  renderForms();
}

async function saveCourses() {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(courses), true);
    showToast('Saved');
  } catch (e) {
    showToast(e && e.message ? e.message : 'Save failed — try again');
  }
}

function currencySymbol(code) {
  const map = { USD: '$', NZD: '$', AUD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: '$', SGD: '$' };
  return map[code] || '';
}

function renderCourses() {
  const grid = document.getElementById('coursesGrid');
  grid.innerHTML = '';
  const visibleCourses = courses.filter(c => c.enabled !== false);
  visibleCourses.forEach(c => {
    const card = document.createElement('div');
    card.className = 'card reveal';
    const hasLink = c.stripePriceId && c.stripePriceId.trim().length > 0;
    const hasDemo = c.demoLink && c.demoLink.trim().length > 0;
    // Flags default to true if never explicitly set (e.g. courses saved
    // before this feature existed), so nothing disappears unexpectedly.
    const demoEnabled = c.showDemoButton !== false;
    const enrollEnabled = c.showEnrollButton !== false;
    card.innerHTML = `
      <div class="card-glow"></div>
      <div class="stage-id mono">${escapeHtml(c.stageId)}</div>
      <h2>${escapeHtml(c.title)}</h2>
      <div class="desc">${escapeHtml(c.desc)}</div>
      <ul class="modules">
        ${c.modules.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
      </ul>
      <div class="card-foot">
        <div class="price-block">
          <div class="price"><span class="cur mono">${escapeHtml(c.currency)}</span>${currencySymbol(c.currency)}${escapeHtml(c.fee)}</div>
          <div class="convert-row" id="convert-${c.id}"></div>
        </div>
        <div class="card-buttons">
          ${demoEnabled ? `
            <button class="demo-btn ${hasDemo ? '' : 'disabled'}" data-demo-id="${c.id}">
              ${hasDemo ? 'Book Free Demo Session' : 'Demo link not set'}
            </button>
          ` : ''}
          ${enrollEnabled ? `
            <button class="enroll ${hasLink ? '' : 'disabled'}" data-id="${c.id}">
              ${hasLink ? 'Enroll &amp; Pay' : 'Not configured'}
            </button>
          ` : ''}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Re-run scroll reveal for newly injected cards
  if (window.KCAnimations && window.KCAnimations.observeReveals) {
    window.KCAnimations.observeReveals();
  }

  document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const course = courses.find(c => c.id === btn.dataset.demoId);
      if (course && course.demoLink) {
        window.open(course.demoLink, '_blank', 'noopener');
      }
    });
  });

  document.querySelectorAll('.enroll').forEach(btn => {
    btn.addEventListener('click', () => {
      const course = courses.find(c => c.id === btn.dataset.id);
      if (course && course.stripePriceId && window.KCEnroll) {
        window.KCEnroll.open(course);
      }
    });
  });

  // "Choose Your Track" and FAQ visibility depends on both this course
  // list AND the hero's manual override flag — see js/hero-settings.js,
  // which owns that combined decision since it already tracks the manual
  // flag. Guarded because hero-settings.js may not have finished loading
  // its own settings yet on first paint; it re-runs this same check once
  // it has, so the page ends up correct either way.
  if (window.KCUpdateSectionVisibility) {
    window.KCUpdateSectionVisibility();
  }
}

function renderForms() {
  const container = document.getElementById('courseForms');
  container.innerHTML = '';
  courses.forEach((c, idx) => {
    const block = document.createElement('div');
    block.className = 'course-block';
    block.innerHTML = `
      <h4>${escapeHtml(c.title)}</h4>
      <div class="field">
        <label>Stage label</label>
        <input data-idx="${idx}" data-key="stageId" value="${escapeAttr(c.stageId)}">
      </div>
      <div class="field">
        <label>Course title</label>
        <input data-idx="${idx}" data-key="title" value="${escapeAttr(c.title)}">
      </div>
      <div class="field">
        <label>Description</label>
        <textarea data-idx="${idx}" data-key="desc">${escapeHtml(c.desc)}</textarea>
      </div>
      <div class="field">
        <label>Modules (comma-separated)</label>
        <textarea data-idx="${idx}" data-key="modules">${escapeHtml(c.modules.join(', '))}</textarea>
      </div>
      <div class="row2">
        <div class="field">
          <label>Fee</label>
          <input data-idx="${idx}" data-key="fee" value="${escapeAttr(c.fee)}">
        </div>
        <div class="field">
          <label>Currency</label>
          <select data-idx="${idx}" data-key="currency">
            ${['USD', 'NZD', 'AUD', 'EUR', 'GBP', 'INR', 'CAD', 'SGD'].map(cur =>
              `<option value="${cur}" ${cur === c.currency ? 'selected' : ''}>${cur}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label>Stripe Price ID <span class="field-hint">(from Stripe Dashboard → Product catalog → your price — looks like "price_1AbC...")</span></label>
        <input data-idx="${idx}" data-key="stripePriceId" placeholder="price_1AbCdEfGhIjKlMnOp" value="${escapeAttr(c.stripePriceId)}">
      </div>
      <div class="field">
        <label>WhatsApp group invite link</label>
        <input data-idx="${idx}" data-key="whatsapp" placeholder="https://chat.whatsapp.com/..." value="${escapeAttr(c.whatsapp)}">
      </div>
      <div class="field">
        <label>Book Free Demo Session link <span class="field-hint">(Calendly, WhatsApp, mailto:, or any URL — opens in a new tab)</span></label>
        <input data-idx="${idx}" data-key="demoLink" placeholder="https://calendly.com/..." value="${escapeAttr(c.demoLink)}">
      </div>
      <label class="checkbox-row">
        <input type="checkbox" data-idx="${idx}" data-key="enabled" ${c.enabled !== false ? 'checked' : ''}>
        <span><strong>Show this course on the website</strong> — unchecking removes its card, and if neither course is checked, the "Choose Your Track" and FAQ sections are hidden automatically.</span>
      </label>
      <div class="row2">
        <label class="checkbox-row">
          <input type="checkbox" data-idx="${idx}" data-key="showDemoButton" ${c.showDemoButton !== false ? 'checked' : ''}>
          <span>Show "Book Free Demo Session" button</span>
        </label>
        <label class="checkbox-row">
          <input type="checkbox" data-idx="${idx}" data-key="showEnrollButton" ${c.showEnrollButton !== false ? 'checked' : ''}>
          <span>Show "Enroll &amp; Pay" button</span>
        </label>
      </div>
      <div class="field">
        <label class="field-hint">Fee/currency above are for display only — the actual amount charged comes from the Stripe Price ID. Keep them in sync manually when you change pricing in Stripe.</label>
      </div>
    `;
    container.appendChild(block);
  });

  container.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.idx);
      const key = el.dataset.key;
      if (el.type === 'checkbox') {
        courses[idx][key] = el.checked;
      } else if (key === 'modules') {
        courses[idx][key] = el.value.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        courses[idx][key] = el.value;
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}
function escapeAttr(str) {
  return (str == null ? '' : str).replace(/"/g, '&quot;');
}
