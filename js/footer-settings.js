/**
 * footer-settings.js
 * ---------------------------------------------------------------------------
 * Admin-configurable footer copy: the two disclaimer lines, the legal name
 * on the copyright line, and up to two policy links (terms, privacy, or
 * whatever else you need).
 *
 * Follows the same shape as js/hero-settings.js and
 * js/enrollment-settings.js — its own key in the shared `site-config`
 * Firestore collection, read by everyone on load, written only by
 * signed-in admins. firestore.rules already covers any document under
 * site-config, so adding this key needed no rules change.
 *
 * WHAT THIS DOES NOT COVER: the link-preview text that WhatsApp, LinkedIn
 * and search engines show. That lives in the <meta> tags in index.html and
 * cannot be moved here — preview crawlers read raw HTML and never run
 * JavaScript, so a Firestore-driven value would be invisible to them.
 *
 * The copyright YEAR is not configurable on purpose: js/app.js already
 * fills it from the system clock, so it can never go stale.
 */
const FOOTER_SETTINGS_KEY = 'site-footer-settings-v1';

const defaultFooterSettings = {
  paymentNote: "Payments are handled by your payment provider's checkout page — this site never sees your card details.",
  priceNote: 'Converted prices shown are estimates only. The currency and exact amount charged are confirmed at checkout.',
  legalName: 'Snowflake Training',
  linkOneLabel: '',
  linkOneUrl: '',
  linkTwoLabel: '',
  linkTwoUrl: ''
};

let footerSettings = { ...defaultFooterSettings };

async function loadFooterSettings() {
  try {
    const res = await window.storage.get(FOOTER_SETTINGS_KEY, true);
    footerSettings = res && res.value
      ? { ...defaultFooterSettings, ...JSON.parse(res.value) }
      : { ...defaultFooterSettings };
  } catch (e) {
    console.warn('[footer-settings] Falling back to defaults — Firestore read failed:', e);
    footerSettings = { ...defaultFooterSettings };
  }
  applyFooterSettings();
  renderFooterSettingsForm();
}

/**
 * Only these schemes are allowed on footer links. Blocks javascript: and
 * data: URLs, which would otherwise be a stored-XSS route for anyone with
 * write access to the settings document.
 */
function isSafeFooterUrl(url) {
  const v = String(url || '').trim();
  if (!v) return false;
  return /^(https?:\/\/|mailto:|\/|#)/i.test(v);
}

function applyFooterSettings() {
  // Blank means "hide this line", which is the only way to remove a
  // disclaimer without editing the HTML.
  setFooterLine('footerPaymentNote', footerSettings.paymentNote);
  setFooterLine('footerPriceNote', footerSettings.priceNote);

  const nameEl = document.getElementById('footerLegalName');
  if (nameEl) nameEl.textContent = footerSettings.legalName || '';

  const linksEl = document.getElementById('footerLegalLinks');
  if (linksEl) {
    linksEl.textContent = '';
    const pairs = [
      { label: footerSettings.linkOneLabel, url: footerSettings.linkOneUrl },
      { label: footerSettings.linkTwoLabel, url: footerSettings.linkTwoUrl }
    ];
    pairs.forEach(({ label, url }) => {
      const text = String(label || '').trim();
      if (!text) return;
      linksEl.appendChild(document.createTextNode(' · '));
      if (isSafeFooterUrl(url)) {
        const a = document.createElement('a');
        // textContent, not innerHTML — the label is admin input and is
        // never treated as markup.
        a.textContent = text;
        a.href = String(url).trim();
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        linksEl.appendChild(a);
      } else {
        // Label with no usable URL still renders, just not as a link.
        linksEl.appendChild(document.createTextNode(text));
      }
    });
  }

  // Hide the whole line if there is nothing on it but the year.
  const legalLine = document.getElementById('footerLegalLine');
  if (legalLine) {
    const hasContent = !!(footerSettings.legalName || '').trim()
      || !!(footerSettings.linkOneLabel || '').trim()
      || !!(footerSettings.linkTwoLabel || '').trim();
    legalLine.style.display = hasContent ? '' : 'none';
  }
}

function setFooterLine(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  const value = String(text == null ? '' : text).trim();
  el.textContent = value;
  el.style.display = value ? '' : 'none';
}

async function saveFooterSettings() {
  try {
    await window.storage.set(FOOTER_SETTINGS_KEY, JSON.stringify(footerSettings), true);
    applyFooterSettings();
    if (typeof showToast === 'function') showToast('Saved');
  } catch (e) {
    if (typeof showToast === 'function') {
      showToast(e && e.message ? e.message : 'Save failed — try again');
    }
  }
}

function renderFooterSettingsForm() {
  const container = document.getElementById('footerSettingsForm');
  if (!container) return;
  container.innerHTML = `
    <div class="field">
      <label>Payment disclaimer <span class="field-hint">(leave blank to hide this line)</span></label>
      <textarea id="fs-paymentNote" rows="2">${escapeHtml(footerSettings.paymentNote)}</textarea>
    </div>
    <div class="field">
      <label>Currency disclaimer <span class="field-hint">(leave blank to hide this line)</span></label>
      <textarea id="fs-priceNote" rows="2">${escapeHtml(footerSettings.priceNote)}</textarea>
    </div>
    <div class="field">
      <label>Copyright name <span class="field-hint">(the year is added automatically from the current date)</span></label>
      <input id="fs-legalName" placeholder="Snowflake Training" value="${escapeAttr(footerSettings.legalName)}">
    </div>
    <div class="row2">
      <div class="field">
        <label>Footer link 1 — label</label>
        <input id="fs-linkOneLabel" placeholder="Terms &amp; Conditions" value="${escapeAttr(footerSettings.linkOneLabel)}">
      </div>
      <div class="field">
        <label>Footer link 1 — URL</label>
        <input id="fs-linkOneUrl" placeholder="https://…" value="${escapeAttr(footerSettings.linkOneUrl)}">
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label>Footer link 2 — label</label>
        <input id="fs-linkTwoLabel" placeholder="Privacy Policy" value="${escapeAttr(footerSettings.linkTwoLabel)}">
      </div>
      <div class="field">
        <label>Footer link 2 — URL</label>
        <input id="fs-linkTwoUrl" placeholder="https://…" value="${escapeAttr(footerSettings.linkTwoUrl)}">
      </div>
    </div>
    <div class="field">
      <label class="field-hint">The text shown when this link is shared on WhatsApp or LinkedIn is not set here — it lives in the &lt;meta&gt; tags in index.html, because preview crawlers do not run JavaScript.</label>
    </div>
  `;

  const map = {
    'fs-paymentNote': 'paymentNote',
    'fs-priceNote': 'priceNote',
    'fs-legalName': 'legalName',
    'fs-linkOneLabel': 'linkOneLabel',
    'fs-linkOneUrl': 'linkOneUrl',
    'fs-linkTwoLabel': 'linkTwoLabel',
    'fs-linkTwoUrl': 'linkTwoUrl'
  };
  container.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => {
      const key = map[el.id];
      if (key) footerSettings[key] = el.value;
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('footerSettingsSaveBtn');
  if (btn) btn.addEventListener('click', saveFooterSettings);
  loadFooterSettings();
});
