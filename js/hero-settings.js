/**
 * hero-settings.js
 * ---------------------------------------------------------------------------
 * Admin-configurable content for the event-style hero banner (eyebrow,
 * headline, tagline, city/date badge for the demo session), plus a flag to
 * hide the "Choose Your Track" courses section entirely, and the on-page
 * demo-session registration form (first/last name, email, phone).
 *
 * Content is stored in Firestore via the same window.storage.get/set used
 * everywhere else, under its own key — reuses the existing
 * admin-auth-gated save path.
 *
 * The registration form submits to /api/demo-registration (a new, minimal
 * serverless function — see that file's header comment). It only stores
 * the lead in Firestore right now; it does not send a confirmation email
 * or sync to Google Sheets the way paid enrollments do. If you want that
 * too, say so and it can be added the same way the enrollment flow was.
 */
const HERO_SETTINGS_KEY = 'site-hero-settings-v1';

const defaultHeroSettings = {
  eyebrow: 'SNOWFLAKE TRAINING · FREE DEMO SESSION',
  title: 'FREE SNOWFLAKE\nDEMO SESSION',
  tagline: 'MAKING YOU JOB-READY, FASTER',
  city: 'ONLINE',
  date: 'DATE TO BE ANNOUNCED',
  hideChooseTrack: false
};

let heroSettings = { ...defaultHeroSettings };

async function loadHeroSettings() {
  try {
    const res = await window.storage.get(HERO_SETTINGS_KEY, true);
    heroSettings = res && res.value ? { ...defaultHeroSettings, ...JSON.parse(res.value) } : { ...defaultHeroSettings };
  } catch (e) {
    console.warn('[hero-settings] Falling back to defaults — Firestore read failed:', e);
    heroSettings = { ...defaultHeroSettings };
  }
  applyHeroSettings();
  renderHeroSettingsForm();
}

function applyHeroSettings() {
  const eyebrowEl = document.getElementById('heroEyebrow');
  const titleEl = document.getElementById('heroTitle');
  const taglineEl = document.getElementById('heroTagline');
  const cityEl = document.getElementById('heroCity');
  const dateEl = document.getElementById('heroDate');
  const coursesSection = document.getElementById('courses');

  if (eyebrowEl) eyebrowEl.textContent = heroSettings.eyebrow;
  if (titleEl) titleEl.innerHTML = escapeHtml(heroSettings.title).replace(/\n/g, '<br>');
  if (taglineEl) taglineEl.textContent = heroSettings.tagline;
  if (cityEl) cityEl.textContent = heroSettings.city;
  if (dateEl) dateEl.textContent = heroSettings.date;

  if (coursesSection) {
    coursesSection.style.display = heroSettings.hideChooseTrack ? 'none' : '';
  }
  // Keep the nav's "Courses" link consistent with whether that section
  // actually exists on the page right now.
  const coursesNavLink = document.querySelector('.nav-links a[href="#courses"]');
  if (coursesNavLink) {
    coursesNavLink.style.display = heroSettings.hideChooseTrack ? 'none' : '';
  }
}

async function saveHeroSettings() {
  try {
    await window.storage.set(HERO_SETTINGS_KEY, JSON.stringify(heroSettings), true);
    applyHeroSettings();
    if (typeof showToast === 'function') showToast('Saved');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Save failed — try again');
  }
}

function renderHeroSettingsForm() {
  const container = document.getElementById('heroSettingsForm');
  if (!container) return;
  container.innerHTML = `
    <div class="field">
      <label>Eyebrow label (small text above headline)</label>
      <input id="hs-eyebrow" value="${escapeAttr(heroSettings.eyebrow)}">
    </div>
    <div class="field">
      <label>Headline <span class="field-hint">(press Enter for a line break, like the reference banner)</span></label>
      <textarea id="hs-title" rows="2">${escapeHtml(heroSettings.title)}</textarea>
    </div>
    <div class="field">
      <label>Tagline</label>
      <input id="hs-tagline" value="${escapeAttr(heroSettings.tagline)}">
    </div>
    <div class="row2">
      <div class="field">
        <label>City / location badge (top line)</label>
        <input id="hs-city" value="${escapeAttr(heroSettings.city)}">
      </div>
      <div class="field">
        <label>Demo session date (bottom line)</label>
        <input id="hs-date" placeholder="e.g. 3 SEPTEMBER 2026" value="${escapeAttr(heroSettings.date)}">
      </div>
    </div>
    <label class="checkbox-row">
      <input type="checkbox" id="hs-hideChooseTrack" ${heroSettings.hideChooseTrack ? 'checked' : ''}>
      <span>Hide the "Choose Your Track" courses section from the page</span>
    </label>
  `;
  container.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => {
      if (el.id === 'hs-hideChooseTrack') {
        heroSettings.hideChooseTrack = el.checked;
        return;
      }
      const map = {
        'hs-eyebrow': 'eyebrow', 'hs-title': 'title', 'hs-tagline': 'tagline',
        'hs-city': 'city', 'hs-date': 'date'
      };
      const key = map[el.id];
      if (key) heroSettings[key] = el.value;
    });
  });
}

// --- Demo session registration form (in the hero card) ---------------------

function populateHeroDemoCountryCodes() {
  const select = document.getElementById('heroDemoCountryCode');
  if (!select || !window.KC_COUNTRY_CODES) return;
  select.innerHTML = window.KC_COUNTRY_CODES
    .map(c => `<option value="${c.dial}">${c.dial} ${c.name}</option>`)
    .join('');
  const nz = window.KC_COUNTRY_CODES.findIndex(c => c.iso === 'NZ');
  select.selectedIndex = nz >= 0 ? nz : 0;
}

function initHeroDemoForm() {
  populateHeroDemoCountryCodes();
  const form = document.getElementById('heroDemoForm');
  const errorEl = document.getElementById('heroDemoError');
  const submitBtn = document.getElementById('heroDemoSubmitBtn');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const firstName = document.getElementById('heroDemoFirstName').value.trim();
    const lastName = document.getElementById('heroDemoLastName').value.trim();
    const email = document.getElementById('heroDemoEmail').value.trim();
    const dial = document.getElementById('heroDemoCountryCode').value;
    const localNumber = document.getElementById('heroDemoPhone').value.trim().replace(/[^\d]/g, '');

    if (!firstName || !lastName || !email || !localNumber) {
      errorEl.textContent = 'Please fill in all fields.';
      return;
    }

    const phone = `${dial}${localNumber}`;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering…';

    try {
      const res = await fetch('/api/demo-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not register — please try again.');

      form.style.display = 'none';
      const card = form.closest('.event-hero-card');
      if (card) {
        const confirmEl = document.createElement('div');
        confirmEl.className = 'hero-form-confirm';
        confirmEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Thanks, ${escapeHtml(firstName)}! You're registered for the free demo session — we'll be in touch by email.`;
        card.appendChild(confirmEl);
      }
    } catch (err) {
      console.error('[hero-demo-form] registration failed:', err);
      errorEl.textContent = err.message || 'Something went wrong — please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register now';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('heroSettingsSaveBtn');
  if (btn) btn.addEventListener('click', saveHeroSettings);
  loadHeroSettings();
  initHeroDemoForm();
});
