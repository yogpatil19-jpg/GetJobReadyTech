/**
 * api/stripe-webhook.js
 * ---------------------------------------------------------------------------
 * Stripe calls this URL directly (server-to-server) when a payment event
 * happens. Configure it in Stripe Dashboard → Developers → Webhooks:
 *   Endpoint URL: https://YOUR-DOMAIN/api/stripe-webhook
 *   Event to send: checkout.session.completed
 * Copy the "Signing secret" it gives you into STRIPE_WEBHOOK_SECRET.
 *
 * ⚠️ SECURITY CRITICAL: this endpoint verifies Stripe's signature on every
 * request (`stripe.webhooks.constructEvent`). Without that check, anyone
 * could POST a fake "payment succeeded" event and trigger free course
 * access, a fake receipt email, and a fake spreadsheet row. Do not remove
 * or weaken the signature check.
 *
 * IDEMPOTENCY: Stripe retries webhooks that don't return 200 quickly, and
 * can occasionally send the same event more than once even on success. We
 * check the lead's `status` before doing anything, so a repeat delivery of
 * the same event does not send a second email or add a second spreadsheet
 * row.
 *
 * I have not run this against a live Stripe webhook — verify
 * `stripe.webhooks.constructEvent` and the raw-body handling below against
 * https://stripe.com/docs/webhooks/quickstart before relying on it. Test it
 * end-to-end with the Stripe CLI (`stripe listen --forward-to
 * localhost:3000/api/stripe-webhook` + `stripe trigger checkout.session.completed`)
 * before going live — see README.md "Testing the enrollment flow".
 */
const Stripe = require('stripe');
const { getDb } = require('./_lib/firebaseAdmin');
const { generateQrPngBuffer } = require('./_lib/qrcode');
const { sendReceiptEmail } = require('./_lib/email');
const { appendEnrollmentRow } = require('./_lib/googleSheets');

const STORAGE_KEY = 'kiwicraft-snowflake-courses-v1';
const ENROLLMENT_SETTINGS_KEY = 'site-enrollment-settings-v1';

// Vercel-specific: we need the raw request body (unparsed) to verify
// Stripe's signature, so JSON body-parsing must be disabled for this route.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    res.status(500).send('Webhook not configured');
    return;
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    res.status(400).send(`Webhook signature verification failed`);
    return;
  }

  // Acknowledge fast, then do the work — Stripe expects a quick response.
  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object);
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] handler failed:', err);
    // Return 500 so Stripe retries — but our idempotency check means a
    // retry after a partial failure won't double-send anything that
    // already succeeded.
    res.status(500).send('Internal error processing webhook');
  }
};

async function handleCheckoutCompleted(session) {
  const db = getDb();
  const leadId = session.metadata && session.metadata.leadId;
  if (!leadId) {
    console.error('[stripe-webhook] Checkout session has no leadId in metadata:', session.id);
    return;
  }

  const leadRef = db.collection('leads').doc(leadId);
  const leadSnap = await leadRef.get();
  if (!leadSnap.exists) {
    console.error('[stripe-webhook] No lead found for id:', leadId);
    return;
  }
  const lead = leadSnap.data();

  // Idempotency guard — if we've already fully processed this lead, stop.
  if (lead.status === 'paid' && lead.emailSent && lead.sheetSynced) {
    console.log('[stripe-webhook] Lead already fully processed, skipping:', leadId);
    return;
  }

  const amountFormatted = `${(session.amount_total / 100).toFixed(2)} ${String(session.currency).toUpperCase()}`;

  await leadRef.update({
    status: 'paid',
    stripePaymentIntentId: session.payment_intent || null,
    amountTotal: session.amount_total,
    currency: session.currency,
    paidAt: new Date().toISOString()
  });

  // Look up course WhatsApp link + title (course data may have changed
  // since the lead was created, so re-fetch fresh).
  const configDoc = await db.collection('site-config').doc(STORAGE_KEY).get();
  const courses = configDoc.exists ? JSON.parse(configDoc.data().value || '[]') : [];
  const course = courses.find(c => c.id === lead.courseId) || {};
  const whatsappLink = course.whatsapp || '';

  // Optional configurable email template (see js/enrollment-settings.js —
  // the admin panel stores { termsUrl, emailSubject, emailBody }).
  let template = null;
  try {
    const settingsDoc = await db.collection('site-config').doc(ENROLLMENT_SETTINGS_KEY).get();
    if (settingsDoc.exists) {
      const raw = JSON.parse(settingsDoc.data().value || '{}');
      if (raw.emailSubject || raw.emailBody) {
        template = { subject: raw.emailSubject, body: raw.emailBody };
      }
    }
  } catch (e) {
    console.warn('[stripe-webhook] Could not read enrollment-settings, using default email template:', e.message);
  }

  let qrPngBuffer = null;
  if (whatsappLink) {
    try {
      qrPngBuffer = await generateQrPngBuffer(whatsappLink);
    } catch (e) {
      console.error('[stripe-webhook] QR generation failed:', e);
    }
  }

  const failures = [];

  if (!lead.emailSent) {
    try {
      await sendReceiptEmail({
        to: lead.email,
        name: lead.name,
        courseTitle: lead.courseTitle,
        amount: amountFormatted,
        whatsappLink: whatsappLink || '(WhatsApp link not configured yet — contact us and we will send it.)',
        qrPngBuffer,
        template
      });
      await leadRef.update({ emailSent: true });
    } catch (e) {
      console.error('[stripe-webhook] Sending receipt email failed:', e);
      failures.push('email');
    }
  }

  if (!lead.sheetSynced) {
    try {
      await appendEnrollmentRow([
        new Date().toISOString(),
        lead.name,
        lead.email,
        lead.phone,
        lead.courseId,
        lead.courseTitle,
        amountFormatted,
        lead.comments || '',
        lead.whatsappOptIn ? 'Yes' : 'No'
      ]);
      await leadRef.update({ sheetSynced: true });
    } catch (e) {
      console.error('[stripe-webhook] Google Sheets append failed:', e);
      failures.push('sheet');
    }
  }

  if (failures.length) {
    // Throwing here makes the outer handler return 500, which makes Stripe
    // retry this same event later. Because of the emailSent/sheetSynced
    // guards above, a retry will only re-attempt the piece(s) that failed —
    // it won't re-send an email or add a duplicate row that already
    // succeeded.
    throw new Error(`Post-payment fulfillment incomplete: ${failures.join(', ')} failed.`);
  }
}
