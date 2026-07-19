/**
 * api/_lib/validate.js
 * ---------------------------------------------------------------------------
 * Server-side validation. The browser form in js/enroll.js does its own
 * validation too, but that's UX only — anyone can call these API endpoints
 * directly with a tool like curl, bypassing the browser entirely. Every
 * field is re-checked here; nothing from the client is trusted.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164-ish: + followed by 8–15 digits total (covers country code + number).
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

const MAX_NAME_LEN = 120;
const MAX_COMMENTS_LEN = 1000;

function validateEnrollmentInput(body) {
  const errors = [];
  const out = {};

  const name = String(body.name || '').trim();
  if (!name) errors.push('Name is required.');
  if (name.length > MAX_NAME_LEN) errors.push(`Name must be under ${MAX_NAME_LEN} characters.`);
  out.name = name.slice(0, MAX_NAME_LEN);

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) errors.push('A valid email address is required.');
  out.email = email;

  // Expect phone already combined as E.164 (e.g. "+64211234567") — the
  // client builds this from the country-code dropdown + number field.
  const phone = String(body.phone || '').trim().replace(/[\s-]/g, '');
  if (!PHONE_RE.test(phone)) errors.push('A valid phone number with country code is required.');
  out.phone = phone;

  const comments = String(body.comments || '').trim();
  if (comments.length > MAX_COMMENTS_LEN) errors.push(`Comments must be under ${MAX_COMMENTS_LEN} characters.`);
  out.comments = comments.slice(0, MAX_COMMENTS_LEN);

  if (body.termsAccepted !== true) errors.push('You must accept the Terms & Conditions to continue.');
  if (body.detailsConfirmed !== true) errors.push('You must confirm your details are correct to continue.');
  out.termsAccepted = true;
  out.detailsConfirmed = true;
  out.whatsappOptIn = body.whatsappOptIn === true;

  const courseId = String(body.courseId || '').trim();
  if (!courseId) errors.push('Missing course selection.');
  out.courseId = courseId;

  return { valid: errors.length === 0, errors, data: out };
}

function validateDemoRegistrationInput(body) {
  const errors = [];
  const out = {};

  const firstName = String(body.firstName || '').trim();
  if (!firstName) errors.push('First name is required.');
  out.firstName = firstName.slice(0, MAX_NAME_LEN);

  const lastName = String(body.lastName || '').trim();
  if (!lastName) errors.push('Last name is required.');
  out.lastName = lastName.slice(0, MAX_NAME_LEN);

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) errors.push('A valid email address is required.');
  out.email = email;

  const countryCode = String(body.countryCode || '').trim();
  const phoneNumber = String(body.phoneNumber || '').trim().replace(/[^\d]/g, '');
  const phone = `${countryCode}${phoneNumber}`.replace(/[\s-]/g, '');
  if (!countryCode) errors.push('A country code is required.');
  if (!phoneNumber) errors.push('A phone number is required.');
  if ((countryCode || phoneNumber) && !PHONE_RE.test(phone)) {
    errors.push('A valid phone number with country code is required.');
  }
  out.countryCode = countryCode;
  out.phoneNumber = phoneNumber;
  out.phone = phone; // combined value, kept for the confirmation email and any existing consumers

  if (body.termsAccepted !== true) errors.push('You must accept the Terms & Conditions to continue.');
  if (body.detailsConfirmed !== true) errors.push('You must confirm your details are correct to continue.');
  out.termsAccepted = true;
  out.detailsConfirmed = true;
  out.whatsappOptIn = body.whatsappOptIn === true;

  return { valid: errors.length === 0, errors, data: out };
}

module.exports = { validateEnrollmentInput, validateDemoRegistrationInput, EMAIL_RE, PHONE_RE };
