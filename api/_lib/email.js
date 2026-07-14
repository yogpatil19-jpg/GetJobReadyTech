/**
 * api/_lib/email.js
 * ---------------------------------------------------------------------------
 * Sends the payment receipt email using Nodemailer over plain SMTP — works
 * with any provider (Gmail app password, SendGrid/Mailgun/Postmark SMTP
 * relay, your own mail server, etc.), so you're not locked into one vendor.
 *
 * Required environment variables (set in Vercel → Project → Settings →
 * Environment Variables):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
 *
 * The subject/body are configurable at runtime via the
 * `site-config/enrollment-settings` Firestore document (edited from the
 * admin settings panel — see js/enrollment-settings.js), with a hard-coded
 * fallback template here in case that document doesn't exist yet.
 *
 * I have high confidence in Nodemailer's API shape (it's been stable for
 * years), but I have not sent a real email with this exact code — test it
 * with your real SMTP credentials before relying on it (see README.md
 * "Testing the enrollment flow").
 */
const nodemailer = require('nodemailer');

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must all be set.');
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for 587/25 (STARTTLS)
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DEFAULT_SUBJECT = 'Your enrollment receipt — {{courseTitle}}';
const DEFAULT_BODY = `Hi {{name}},

Thanks for enrolling in {{courseTitle}}! Your payment of {{amount}} was received successfully.

Join the course WhatsApp group here: {{whatsappLink}}
(Or scan the QR code attached to this email.)

If you have any questions, just reply to this email.

Welcome aboard!`;

function fillTemplate(template, vars) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? vars[key] : ''));
}

/**
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.name
 * @param {string} opts.courseTitle
 * @param {string} opts.amount - formatted, e.g. "USD 199.00"
 * @param {string} opts.whatsappLink
 * @param {Buffer} opts.qrPngBuffer
 * @param {{subject?: string, body?: string}} [opts.template] - from Firestore config, optional
 */
async function sendReceiptEmail(opts) {
  const transport = getTransport();
  const vars = {
    name: opts.name,
    courseTitle: opts.courseTitle,
    amount: opts.amount,
    whatsappLink: opts.whatsappLink
  };

  const subjectTemplate = (opts.template && opts.template.subject) || DEFAULT_SUBJECT;
  const bodyTemplate = (opts.template && opts.template.body) || DEFAULT_BODY;

  const subject = fillTemplate(subjectTemplate, vars);
  const textBody = fillTemplate(bodyTemplate, vars);
  // HTML version: escape user-controlled values (name, courseTitle) before
  // embedding, then convert newlines to <br> for basic formatting.
  const htmlBody = fillTemplate(escapeHtml(bodyTemplate), {
    name: escapeHtml(vars.name),
    courseTitle: escapeHtml(vars.courseTitle),
    amount: escapeHtml(vars.amount),
    whatsappLink: `<a href="${escapeHtml(vars.whatsappLink)}">${escapeHtml(vars.whatsappLink)}</a>`
  }).replace(/\n/g, '<br>');

  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to: opts.to,
    subject,
    text: textBody,
    html: htmlBody,
    attachments: opts.qrPngBuffer
      ? [{ filename: 'whatsapp-group-qr.png', content: opts.qrPngBuffer, cid: 'whatsapp-qr' }]
      : []
  });
}

module.exports = { sendReceiptEmail, fillTemplate, DEFAULT_SUBJECT, DEFAULT_BODY };
