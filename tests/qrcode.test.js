const test = require('node:test');
const assert = require('node:assert/strict');
const { generateQrPngBuffer } = require('../api/_lib/qrcode');

test('generateQrPngBuffer produces a real, valid PNG for a WhatsApp link', async () => {
  const buf = await generateQrPngBuffer('https://chat.whatsapp.com/ABC123EXAMPLE');
  assert.ok(Buffer.isBuffer(buf));
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buf.subarray(0, 8).equals(pngMagic), 'output should start with PNG magic bytes');
  assert.ok(buf.length > 100, 'PNG should have real image data, not be empty');
});

test('generateQrPngBuffer rejects/handles an empty link gracefully', async () => {
  await assert.rejects(() => generateQrPngBuffer(''));
});
