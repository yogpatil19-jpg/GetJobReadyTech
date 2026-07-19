/**
 * api/demo-registration.js
 * ---------------------------------------------------------------------------
 * POST { firstName, lastName, email, phone, termsAccepted, detailsConfirmed,
 *        whatsappOptIn }
 * → { ok: true }
 *
 * On a valid submission, this:
 *   1. Saves the registration to Firestore (`leads` collection, kind: 'demo').
 *   2. Appends a row to the Google Sheet, tab "DemoRegistration" (same
 *      spreadsheet/credentials as paid enrollments — GOOGLE_SHEETS_SPREADSHEET_ID
 *      / GOOGLE_SERVICE_ACCOUNT_KEY — just a different tab. Create that tab
 *      in your sheet before going live, same as "Enrollments").
 *   3. Emails the registrant a confirmation, with a .ics calendar invite
 *      attached IF a demo session date/time is configured in the admin
 *      panel (Hero banner settings). If no date/time is configured yet,
 *      the email still sends, just without the calendar attachment.
 *
 * DESIGN NOTE — no automatic retry: unlike the paid-enrollment flow (which
 * gets automatic retries from Stripe's webhook system if email/Sheets
 * fail), this is a single synchronous request with no built-in retry.
 * If the email or Sheets step fails after the registration itself is
 * saved, the visitor still sees "you're registered" (the important part
 * succeeded), but the failure is logged server-side only — check Vercel's
 * function logs if a registrant reports not receiving their invite. A
 * "resend" admin action would be a reasonable future improvement if this
 * becomes a frequent issue.
 *
 * I have not run this against live Stripe/Firebase/Sheets/SMTP credentials
 * — the input validation, email template rendering, and .ics generation
 * this depends on are covered by real, passing automated tests (see
 * tests/), but the actual network calls to Firestore/Sheets/SMTP have not
 * been exercised end-to-end. Please test with a real registration before
 * relying on this.
 */
const { getDb, serverTimestamp } = require('./_lib/firebaseAdmin');
const { validateDemoRegistrationInput } = require('./_lib/validate');
const { appendEnrollmentRow } = require('./_lib/googleSheets');
const { sendDemoConfirmationEmail } = require('./_lib/email');
const { buildDemoSessionIcs } = require('./_lib/calendarInvite');

const HERO_SETTINGS_KEY = 'site-hero-settings-v1';
const ENROLLMENT_SETTINGS_KEY = 'site-enrollment-settings-v1';
const DEMO_SHEET_TAB = 'DemoRegistration';

/** Pulls the bare email address out of a MAIL_FROM value like
 *  '"KiwiCraft" <no-reply@example.com>' or a plain 'no-reply@example.com'. */
function extractEmailAddress(mailFrom) {
  if (!mailFrom) return undefined;
  const match = /<([^>]+)>/.exec(mailFrom);
  return match ? match[1] : mailFrom.trim();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { valid, errors, data } = validateDemoRegistrationInput(req.body || {});
  if (!valid) {
    res.status(400).json({ error: errors.join(' ') });
    return;
  }

  let db;
  try {
    db = getDb();
  } catch (e) {
    console.error('[demo-registration] Firebase Admin init failed:', e.message);
    res.status(500).json({ error: 'Could not connect to the database.' });
    return;
  }

  // Save the registration first — this is the part that must succeed for
  // the visitor to see "you're registered". Email/Sheets happen after and
  // don't block this response's success/fail status.
  let leadRef;
  try {
    leadRef = await db.collection('leads').add({
      kind: 'demo',
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      countryCode: data.countryCode,
      phoneNumber: data.phoneNumber,
      phone: data.phone,
      termsAcceptedAt: serverTimestamp(),
      whatsappOptIn: data.whatsappOptIn,
      status: 'registered',
      createdAt: serverTimestamp(),
      emailSent: false,
      sheetSynced: false
    });
  } catch (e) {
    console.error('[demo-registration] Firestore write failed:', e.message);
    res.status(500).json({ error: 'Could not save your registration — please try again.' });
    return;
  }

  // Everything below is best-effort — log failures, but still tell the
  // visitor their registration succeeded, since it did.
  const failures = [];

  try {
    await appendEnrollmentRow([
      new Date().toISOString(),
      data.firstName,
      data.lastName,
      data.email,
      data.countryCode,
      data.phoneNumber,
      data.whatsappOptIn ? 'Yes' : 'No'
    ], DEMO_SHEET_TAB);
    await leadRef.update({ sheetSynced: true });
  } catch (e) {
    console.error('[demo-registration] Google Sheets append failed:', e.message);
    failures.push('sheet');
  }

  try {
    let heroSettings = {};
    try {
      const heroDoc = await db.collection('site-config').doc(HERO_SETTINGS_KEY).get();
      if (heroDoc.exists) heroSettings = JSON.parse(heroDoc.data().value || '{}');
    } catch (e) {
      console.warn('[demo-registration] Could not read hero settings for calendar invite:', e.message);
    }

    let icsBuffer = null;
    let sessionDetailsText = '';
    if (heroSettings.demoDateTime && heroSettings.demoUtcOffset) {
      try {
        const ics = buildDemoSessionIcs({
          dateTimeLocal: heroSettings.demoDateTime,
          utcOffset: heroSettings.demoUtcOffset,
          durationMinutes: Number(heroSettings.demoDurationMinutes) || 60,
          summary: 'Free Snowflake Demo Session',
          description: heroSettings.tagline || 'Free Snowflake demo session.',
          location: heroSettings.calendarInviteLink || '',
          organizerEmail: extractEmailAddress(process.env.MAIL_FROM),
          attendeeEmail: data.email,
          attendeeName: `${data.firstName} ${data.lastName}`.trim()
        });
        icsBuffer = Buffer.from(ics, 'utf-8');
        const dateLabel = heroSettings.date || '';
        const timeLabel = heroSettings.demoTimezoneLabel || `UTC${heroSettings.demoUtcOffset}`;
        sessionDetailsText = [
          dateLabel ? `Date: ${dateLabel}` : '',
          `Time: ${heroSettings.demoDateTime.split('T')[1]} (${timeLabel})`,
          heroSettings.calendarInviteLink ? `Join link: ${heroSettings.calendarInviteLink}` : ''
        ].filter(Boolean).join('\n');
      } catch (e) {
        console.warn('[demo-registration] Calendar invite generation failed, sending email without it:', e.message);
      }
    }

    let template = null;
    try {
      const settingsDoc = await db.collection('site-config').doc(ENROLLMENT_SETTINGS_KEY).get();
      if (settingsDoc.exists) {
        const raw = JSON.parse(settingsDoc.data().value || '{}');
        if (raw.demoEmailSubject || raw.demoEmailBody) {
          template = { subject: raw.demoEmailSubject, body: raw.demoEmailBody };
        }
      }
    } catch (e) {
      console.warn('[demo-registration] Could not read email template settings:', e.message);
    }

    await sendDemoConfirmationEmail({
      to: data.email,
      firstName: data.firstName,
      sessionDetailsText,
      icsBuffer,
      template
    });
    await leadRef.update({ emailSent: true });
  } catch (e) {
    console.error('[demo-registration] Sending confirmation email failed:', e.message);
    failures.push('email');
  }

  if (failures.length) {
    console.warn(`[demo-registration] Registration saved but ${failures.join(', ')} failed for lead ${leadRef.id}. Check logs above for details.`);
  }

  res.status(200).json({ ok: true });
};
