/**
 * api/session-status.js
 * ---------------------------------------------------------------------------
 * GET /api/session-status?session_id=cs_test_...
 * → { paid: boolean, courseTitle, amount, whatsappLink, qrDataUrl }
 *
 * The success page (index.html?enrolled=...&session_id=...) calls this so
 * the visitor sees their receipt, WhatsApp link, and QR code immediately —
 * without waiting on the email to arrive (email can be delayed or land in
 * spam; showing it on-page too is more reliable).
 *
 * SECURITY NOTE: session_id values are long, random, and only ever handed
 * to the one browser that completed that specific checkout (Stripe
 * generates them, we don't). This endpoint reveals name/course/amount for
 * a given session_id, which is an acceptable trade-off for a receipt page —
 * but be aware it's not gated behind login, so don't extend it to return
 * more sensitive data without adding real access control.
 */
const Stripe = require('stripe');
const { getDb } = require('./_lib/firebaseAdmin');
const { generateQrPngBuffer } = require('./_lib/qrcode');

const STORAGE_KEY = 'kiwicraft-snowflake-courses-v1';

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const sessionId = req.query.session_id;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing session_id' });
    return;
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(500).json({ error: 'Payments are not configured yet.' });
    return;
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid';

    const db = getDb();
    const leadId = session.metadata && session.metadata.leadId;
    let lead = null;
    if (leadId) {
      const snap = await db.collection('leads').doc(leadId).get();
      if (snap.exists) lead = snap.data();
    }

    const configDoc = await db.collection('site-config').doc(STORAGE_KEY).get();
    const courses = configDoc.exists ? JSON.parse(configDoc.data().value || '[]') : [];
    const courseId = (lead && lead.courseId) || (session.metadata && session.metadata.courseId);
    const course = courses.find(c => c.id === courseId) || {};
    const whatsappLink = course.whatsapp || '';

    let qrDataUrl = null;
    if (paid && whatsappLink) {
      try {
        const buf = await generateQrPngBuffer(whatsappLink);
        qrDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
      } catch (e) {
        console.error('[session-status] QR generation failed:', e);
      }
    }

    res.status(200).json({
      paid,
      courseTitle: course.title || (lead && lead.courseTitle) || '',
      amount: session.amount_total != null
        ? `${(session.amount_total / 100).toFixed(2)} ${String(session.currency).toUpperCase()}`
        : '',
      whatsappLink,
      qrDataUrl,
      emailSent: !!(lead && lead.emailSent)
    });
  } catch (err) {
    console.error('[session-status] failed:', err);
    res.status(500).json({ error: 'Could not retrieve session status.' });
  }
};
