/**
 * api/demo-registration.js
 * ---------------------------------------------------------------------------
 * POST { firstName, lastName, email, phone }
 * → { ok: true }
 *
 * Minimal endpoint for the hero banner's "Register for the free demo
 * session" form. Unlike the paid enrollment flow (api/create-checkout-session.js
 * + api/stripe-webhook.js), this does NOT currently send a confirmation
 * email or sync to Google Sheets — it only saves the registration to
 * Firestore, in the same `leads` collection as paid enrollments, tagged
 * `kind: 'demo'` so you can tell the two apart.
 *
 * If you want confirmation emails or a Sheets row for demo sign-ups too,
 * that's a reasonable next step — it would reuse the same
 * api/_lib/email.js and api/_lib/googleSheets.js helpers already built for
 * paid enrollments, just triggered from here instead of from a Stripe
 * webhook (there's no payment event to hang it off for a free session).
 *
 * SECURITY: same pattern as the rest of /api — validates everything
 * server-side, uses the Firebase Admin SDK (server-side only credential,
 * never exposed to the browser).
 */
const { getDb, serverTimestamp } = require('./_lib/firebaseAdmin');
const { validateDemoRegistrationInput } = require('./_lib/validate');

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

  try {
    const db = getDb();
    await db.collection('leads').add({
      kind: 'demo',
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      phone: data.phone,
      status: 'registered',
      createdAt: serverTimestamp()
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[demo-registration] failed:', err);
    res.status(500).json({ error: 'Could not save your registration — please try again.' });
  }
};
