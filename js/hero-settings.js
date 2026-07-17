/**
 * hero-settings.js
 * ---------------------------------------------------------------------------
 * Admin-configurable content for the event-style hero banner at the top of
 * the page (eyebrow label, headline, tagline, city/date badge, and the
 * "Book Free Demo Session" button's destination link).
 *
 * Stored in Firestore via the same window.storage.get/set used everywhere
 * else, under its own key — reuses the existing admin-auth-gated save path.
 */
const HERO_SETTINGS_KEY = 'site-hero-settings-v1';

const defaultHeroSettings = {
  eyebrow: 'SNOWFLAKE TRAINING · FREE DEMO SESSION',
  title: 'FREE SNOWFLAKE\nDEMO SESSION',
  tagline: 'MAKING YOU JOB-READY, FASTER',
  city: 'ONLINE',
  date: 'DATE TO BE ANNOUNCED',
  demoLink: ''
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
  const demoBtn = document.getElementById('heroDemoBtn');

  if (eyebrowEl) eyebrowEl.textContent = heroSettings.eyebrow;
  if (titleEl) titleEl.innerHTML = escapeHtml(heroSettings.title).replace(/\n/g, '<br>');
  if (taglineEl) taglineEl.textContent = heroSettings.tagline;
  if (cityEl) cityEl.textContent = heroSettings.city;
  if (dateEl) dateEl.textContent = heroSettings.date;

  if (demoBtn) {
    const hasLink = heroSettings.demoLink && heroSettings.demoLink.trim().length > 0;
    demoBtn.onclick = () => {
      if (hasLink) {
        window.open(heroSettings.demoLink, '_blank', 'noopener');
      } else {
        // No global demo link configured — fall back to scrolling to the
        // courses section, where each course may have its own demo link.
        document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth' });
      }
    };
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
        <label>Date badge (bottom line)</label>
        <input id="hs-date" value="${escapeAttr(heroSettings.date)}">
      </div>
    </div>
    <div class="field">
      <label>"Book Free Demo Session" link <span class="field-hint">(Calendly, WhatsApp, mailto: — leave blank to just scroll to courses instead)</span></label>
      <input id="hs-demoLink" placeholder="https://calendly.com/..." value="${escapeAttr(heroSettings.demoLink)}">
    </div>
  `;
  container.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => {
      const map = {
        'hs-eyebrow': 'eyebrow', 'hs-title': 'title', 'hs-tagline': 'tagline',
        'hs-city': 'city', 'hs-date': 'date', 'hs-demoLink': 'demoLink'
      };
      const key = map[el.id];
      if (key) heroSettings[key] = el.value;
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('heroSettingsSaveBtn');
  if (btn) btn.addEventListener('click', saveHeroSettings);
  loadHeroSettings();
});
