/**
 * enroll.js
 * ---------------------------------------------------------------------------
 * Enrollment modal: collects name/email/phone/comments + consent checkboxes,
 * then calls the /api/create-checkout-session serverless function and
 * redirects to Stripe Checkout.
 *
 * IMPORTANT: all validation here is UX only. The real validation happens
 * server-side in api/_lib/validate.js — anyone could bypass this file
 * entirely and call the API directly, so nothing here is a security
 * boundary. See api/create-checkout-session.js.
 */
(function () {
  let currentCourse = null;

  const overlay = document.getElementById('enrollOverlay');
  const modal = document.getElementById('enrollModal');
  const closeBtn = document.getElementById('enrollCloseBtn');
  const form = document.getElementById('enrollForm');
  const errorEl = document.getElementById('enrollError');
  const submitBtn = document.getElementById('enrollSubmitBtn');
  const countrySelect = document.getElementById('enrollCountryCode');
  const termsLink = document.getElementById('enrollTermsLink');

  function populateCountryCodes() {
    if (!countrySelect || !window.KC_COUNTRY_CODES) return;
    countrySelect.innerHTML = window.KC_COUNTRY_CODES
      .map(c => `<option value="${c.dial}">${c.dial} ${c.name}</option>`)
      .join('');
    // Default to New Zealand if present, otherwise first entry.
    const nz = window.KC_COUNTRY_CODES.findIndex(c => c.iso === 'NZ');
    countrySelect.selectedIndex = nz >= 0 ? nz : 0;
  }

  function openModal(course) {
    currentCourse = course;
    errorEl.textContent = '';
    form.reset();
    populateCountryCodes();
    if (termsLink && window.__KC_TERMS_URL__) {
      termsLink.href = window.__KC_TERMS_URL__;
    }
    if (overlay) overlay.classList.add('open');
    if (modal) modal.classList.add('open');
  }

  function closeModal() {
    if (overlay) overlay.classList.remove('open');
    if (modal) modal.classList.remove('open');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';

      if (!currentCourse) {
        errorEl.textContent = 'Something went wrong — please close this and try again.';
        return;
      }

      const name = document.getElementById('enrollName').value.trim();
      const email = document.getElementById('enrollEmail').value.trim();
      const dial = countrySelect.value;
      const localNumber = document.getElementById('enrollPhoneNumber').value.trim().replace(/[^\d]/g, '');
      const comments = document.getElementById('enrollComments').value.trim();
      const termsAccepted = document.getElementById('enrollTerms').checked;
      const whatsappOptIn = document.getElementById('enrollWhatsapp').checked;
      const detailsConfirmed = document.getElementById('enrollConfirm').checked;

      if (!name || !email || !localNumber) {
        errorEl.textContent = 'Please fill in your name, email, and phone number.';
        return;
      }
      if (!termsAccepted) {
        errorEl.textContent = 'Please accept the Terms & Conditions to continue.';
        return;
      }
      if (!detailsConfirmed) {
        errorEl.textContent = 'Please confirm your details are correct to continue.';
        return;
      }

      const phone = `${dial}${localNumber}`;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Redirecting to payment…';

      try {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: currentCourse.id,
            name, email, phone, comments,
            termsAccepted, detailsConfirmed, whatsappOptIn
          })
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'Could not start checkout — please try again.');
        }
        window.location.href = data.url;
      } catch (err) {
        console.error('[enroll] checkout failed:', err);
        errorEl.textContent = err.message || 'Something went wrong — please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Proceed to pay';
      }
    });
  }

  window.KCEnroll = { open: openModal, close: closeModal };
})();
