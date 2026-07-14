/**
 * api/create-checkout-session.js
 * ---------------------------------------------------------------------------
 * POST { courseId, name, email, phone, comments, whatsappOptIn, termsAccepted,
 *        detailsConfirmed }
 * → { url: "https://checkout.stripe.com/..." }
 *
 * Flow:
 *   1. Validate everything server-side (never trust the browser).
 *   2. Look up the course's Stripe Price ID from Firestore (site-config).
 *   3. Create a "lead" document in Firestore (status: pending) — this is
 *      what the webhook updates to "paid" once Stripe confirms payment.
 *   4. Create a Stripe Checkout Session with metadata.leadId, so the
 *      webhook can find the matching lead.
 *   5. Return the Checkout Session URL for the browser to redirect to.
 *
 * SECURITY: the Stripe secret key and Firebase Admin credentials only ever
 * exist here, server-side — never sent to the browser.
 *
 * I have not run this against a live Stripe account — verify
 * `stripe.checkout.sessions.create` against
 * https://stripe.com/docs/api/checkout/sessions/create before relying on
 * it, and test with a real (test-mode) course + price before going live.
 */
const Stripe = require('stripe');
const { getDb, serverTimestamp } = require('./_lib/firebaseAdmin');
const { validateEnrollmentInput } = require('./_lib/validate');

const STORAGE_KEY = 'kiwicraft-snowflake-courses-v1'; // must match js/courses.js

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(500).json({ error: 'Payments are not configured yet (missing STRIPE_SECRET_KEY).' });
    return;
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  const { valid, errors, data } = validateEnrollmentInput(req.body || {});
  if (!valid) {
    res.status(400).json({ error: errors.join(' ') });
    return;
  }

  try {
    const db = getDb();

    // Look up the course (stored as one JSON blob, same as the public site
    // reads via js/storage.js + js/courses.js).
    const configDoc = await db.collection('site-config').doc(STORAGE_KEY).get();
    if (!configDoc.exists) {
      res.status(400).json({ error: 'Course data is not configured yet.' });
      return;
    }
    const courses = JSON.parse(configDoc.data().value || '[]');
    const course = courses.find(c => c.id === data.courseId);
    if (!course) {
      res.status(400).json({ error: 'Course not found.' });
      return;
    }
    if (!course.stripePriceId) {
      res.status(400).json({ error: 'This course is not open for payment yet — missing Stripe price.' });
      return;
    }

    // Create the lead record BEFORE creating the Checkout Session, so we
    // have an audit trail even if the user abandons checkout.
    const leadRef = db.collection('leads').doc();
    await leadRef.set({
      courseId: data.courseId,
      courseTitle: course.title,
      name: data.name,
      email: data.email,
      phone: data.phone,
      comments: data.comments,
      whatsappOptIn: data.whatsappOptIn,
      termsAcceptedAt: serverTimestamp(),
      status: 'pending',
      createdAt: serverTimestamp(),
      emailSent: false,
      sheetSynced: false
    });

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: course.stripePriceId, quantity: 1 }],
      customer_email: data.email,
      client_reference_id: leadRef.id,
      metadata: { leadId: leadRef.id, courseId: data.courseId },
      success_url: `${origin}/?enrolled=${encodeURIComponent(data.courseId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?enroll_cancelled=${encodeURIComponent(data.courseId)}`
    });

    await leadRef.update({ stripeSessionId: session.id });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session] failed:', err);
    res.status(500).json({ error: 'Something went wrong starting checkout — please try again.' });
  }
};
