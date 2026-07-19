/**
 * enrollment-settings.js
 * ---------------------------------------------------------------------------
 * Admin settings panel section for the things the enrollment flow needs
 * that aren't per-course: the Terms & Conditions link (shown as a checkbox
 * label in the enrollment modal — see js/enroll.js) and the receipt email
 * subject/body template (used by api/stripe-webhook.js after payment).
 *
 * Stored in Firestore under the same site-config collection as course data,
 * via the same window.storage.get/set used everywhere else — reuses the
 * existing admin-auth-gated save path, no new plumbing needed.
 */
const ENROLLMENT_SETTINGS_KEY = 'site-enrollment-settings-v1';

const defaultEnrollmentSettings = {
  termsUrl: '',
  emailSubject: 'Your enrollment receipt — {{courseTitle}}',
  emailBody:
`Hi {{name}},

Thanks for enrolling in {{courseTitle}}! Your payment of {{amount}} was received successfully.

Join the course WhatsApp group here: {{whatsappLink}}
(Or scan the QR code attached to this email.)

If you have any questions, just reply to this email.

Welcome aboard!`
};

let enrollmentSettings = { ...defaultEnrollmentSettings };

async function loadEnrollmentSettings() {
  try {
    const res = await window.storage.get(ENROLLMENT_SETTINGS_KEY, true);
    enrollmentSettings = res && res.value ? JSON.parse(res.value) : { ...defaultEnrollmentSettings };
  } catch (e) {
    console.warn('[enrollment-settings] Falling back to defaults — Firestore read failed:', e);
    enrollmentSettings = { ...defaultEnrollmentSettings };
  }
  window.__KC_TERMS_URL__ = enrollmentSettings.termsUrl || '';
  applyTermsUrlToHeroForm();
  renderEnrollmentSettingsForm();
}

/**
 * The hero demo form's Terms link (js/hero-settings.js) is set up on
 * DOMContentLoaded, but the real terms URL only arrives after this
 * module's async Firestore read completes — which can finish after or
 * before the hero form initializes, depending on network timing. Calling
 * this from both loadEnrollmentSettings() and saveEnrollmentSettings()
 * covers both orders.
 */
function applyTermsUrlToHeroForm() {
  const heroTermsLink = document.getElementById('heroDemoTermsLink');
  if (heroTermsLink && window.__KC_TERMS_URL__) {
    heroTermsLink.href = window.__KC_TERMS_URL__;
  }
}

async function saveEnrollmentSettings() {
  try {
    await window.storage.set(ENROLLMENT_SETTINGS_KEY, JSON.stringify(enrollmentSettings), true);
    window.__KC_TERMS_URL__ = enrollmentSettings.termsUrl || '';
    applyTermsUrlToHeroForm();
    if (typeof showToast === 'function') showToast('Saved');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Save failed — try again');
  }
}

function renderEnrollmentSettingsForm() {
  const container = document.getElementById('enrollmentSettingsForm');
  if (!container) return;
  container.innerHTML = `
    <div class="field">
      <label>Terms &amp; Conditions URL</label>
      <input id="es-termsUrl" placeholder="https://yoursite.com/terms" value="${escapeAttr(enrollmentSettings.termsUrl)}">
    </div>
    <div class="field">
      <label>Receipt email subject <span class="field-hint">(placeholders: {{name}}, {{courseTitle}}, {{amount}}, {{whatsappLink}})</span></label>
      <input id="es-emailSubject" value="${escapeAttr(enrollmentSettings.emailSubject)}">
    </div>
    <div class="field">
      <label>Receipt email body</label>
      <textarea id="es-emailBody" rows="8">${escapeHtml(enrollmentSettings.emailBody)}</textarea>
    </div>
  `;
  container.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => {
      if (el.id === 'es-termsUrl') enrollmentSettings.termsUrl = el.value;
      if (el.id === 'es-emailSubject') enrollmentSettings.emailSubject = el.value;
      if (el.id === 'es-emailBody') enrollmentSettings.emailBody = el.value;
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('enrollmentSettingsSaveBtn');
  if (btn) btn.addEventListener('click', saveEnrollmentSettings);
  loadEnrollmentSettings();
});
