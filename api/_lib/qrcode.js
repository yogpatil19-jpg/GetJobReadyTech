/**
 * api/_lib/qrcode.js
 * ---------------------------------------------------------------------------
 * Generates a QR code (PNG buffer) pointing at a WhatsApp group invite link.
 * Uses the `qrcode` npm package — add it to package.json dependencies.
 */
const QRCode = require('qrcode');

/**
 * @param {string} link - the URL to encode (e.g. WhatsApp group invite link)
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateQrPngBuffer(link) {
  return QRCode.toBuffer(link, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M'
  });
}

module.exports = { generateQrPngBuffer };
