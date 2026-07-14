const test = require('node:test');
const assert = require('node:assert/strict');
const { fillTemplate, DEFAULT_SUBJECT, DEFAULT_BODY } = require('../api/_lib/email');

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
