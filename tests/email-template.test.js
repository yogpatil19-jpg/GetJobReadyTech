const test = require('node:test');
const assert = require('node:assert/strict');
const { fillTemplate, DEFAULT_SUBJECT, DEFAULT_BODY, DEMO_DEFAULT_SUBJECT, DEMO_DEFAULT_BODY } = require('../api/_lib/email');

test('fillTemplate substitutes all placeholders', () => {
  const result = fillTemplate('Hi {{name}}, welcome to {{courseTitle}}!', {
    name: 'Priya', courseTitle: 'Snowflake Developer Stream'
  });
  assert.equal(result, 'Hi Priya, welcome to Snowflake Developer Stream!');
});

test('fillTemplate leaves unknown placeholders blank rather than crashing', () => {
  const result = fillTemplate('Hi {{name}}, your code is {{missingVar}}', { name: 'Priya' });
  assert.equal(result, 'Hi Priya, your code is ');
});

test('default subject and body template render with sample data', () => {
  const subject = fillTemplate(DEFAULT_SUBJECT, { courseTitle: 'Snowflake Identity' });
  assert.equal(subject, 'Your enrollment receipt — Snowflake Identity');

  const body = fillTemplate(DEFAULT_BODY, {
    name: 'Priya', courseTitle: 'Snowflake Identity', amount: '199.00 USD',
    whatsappLink: 'https://chat.whatsapp.com/ABC123'
  });
  assert.match(body, /Hi Priya,/);
  assert.match(body, /Snowflake Identity/);
  assert.match(body, /199\.00 USD/);
  assert.match(body, /https:\/\/chat\.whatsapp\.com\/ABC123/);
});

test('demo confirmation default subject and body render with sample data', () => {
  const subject = fillTemplate(DEMO_DEFAULT_SUBJECT, {});
  assert.equal(subject, "You're registered — Free Snowflake Demo Session");

  const body = fillTemplate(DEMO_DEFAULT_BODY, {
    firstName: 'Priya',
    sessionDetails: 'Date: 3 September 2026, 10:00 AM NZST\nJoin link: https://meet.google.com/abc'
  });
  assert.match(body, /Hi Priya,/);
  assert.match(body, /3 September 2026/);
  assert.match(body, /meet\.google\.com\/abc/);
  assert.match(body, /calendar invite/);
});

test('demo confirmation body falls back gracefully when session details are missing', () => {
  const body = fillTemplate(DEMO_DEFAULT_BODY, { firstName: 'Priya', sessionDetails: '' });
  assert.match(body, /Hi Priya,/);
});
