const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEnrollmentInput, validateDemoRegistrationInput } = require('../api/_lib/validate');

test('rejects missing required fields', () => {
  const { valid, errors } = validateEnrollmentInput({});
  assert.equal(valid, false);
  assert.ok(errors.some(e => /Name/.test(e)));
  assert.ok(errors.some(e => /email/.test(e)));
  assert.ok(errors.some(e => /phone/i.test(e)));
  assert.ok(errors.some(e => /Terms/.test(e)));
  assert.ok(errors.some(e => /confirm your details/.test(e)));
});

test('accepts a fully valid submission', () => {
  const { valid, errors, data } = validateEnrollmentInput({
    courseId: 'identity',
    name: 'Yogesh Patel',
    email: 'Yogesh@Example.com',
    phone: '+64 21 123 4567',
    comments: 'Excited to learn!',
    termsAccepted: true,
    detailsConfirmed: true,
    whatsappOptIn: true
  });
  assert.equal(valid, true, errors.join(' '));
  assert.equal(data.email, 'yogesh@example.com'); // lower-cased
  assert.equal(data.phone, '+642112345 67'.replace(/\s/g, '')); // spaces stripped
});

test('rejects invalid email format', () => {
  const { valid, errors } = validateEnrollmentInput({
    courseId: 'identity', name: 'A', email: 'not-an-email', phone: '+64211234567',
    termsAccepted: true, detailsConfirmed: true
  });
  assert.equal(valid, false);
  assert.ok(errors.some(e => /email/.test(e)));
});

test('rejects phone number without country code / too short', () => {
  const bad1 = validateEnrollmentInput({
    courseId: 'identity', name: 'A', email: 'a@b.com', phone: '0211234567',
    termsAccepted: true, detailsConfirmed: true
  });
  assert.equal(bad1.valid, false);

  const bad2 = validateEnrollmentInput({
    courseId: 'identity', name: 'A', email: 'a@b.com', phone: '+64',
    termsAccepted: true, detailsConfirmed: true
  });
  assert.equal(bad2.valid, false);
});

test('rejects when terms not accepted or details not confirmed', () => {
  const noTerms = validateEnrollmentInput({
    courseId: 'identity', name: 'A', email: 'a@b.com', phone: '+64211234567',
    termsAccepted: false, detailsConfirmed: true
  });
  assert.equal(noTerms.valid, false);

  const noConfirm = validateEnrollmentInput({
    courseId: 'identity', name: 'A', email: 'a@b.com', phone: '+64211234567',
    termsAccepted: true, detailsConfirmed: false
  });
  assert.equal(noConfirm.valid, false);
});

test('truncates overly long name/comments rather than crashing', () => {
  const longName = 'x'.repeat(500);
  const { errors } = validateEnrollmentInput({
    courseId: 'identity', name: longName, email: 'a@b.com', phone: '+64211234567',
    termsAccepted: true, detailsConfirmed: true
  });
  assert.ok(errors.some(e => /under 120 characters/.test(e)));
});

test('requires a courseId', () => {
  const { valid, errors } = validateEnrollmentInput({
    name: 'A', email: 'a@b.com', phone: '+64211234567',
    termsAccepted: true, detailsConfirmed: true
  });
  assert.equal(valid, false);
  assert.ok(errors.some(e => /course selection/.test(e)));
});

test('demo registration: accepts a valid submission', () => {
  const { valid, errors, data } = validateDemoRegistrationInput({
    firstName: 'Yogesh', lastName: 'Patil', email: 'Yog.Patil19@Gmail.com', phone: '+64 29 022 04004'
  });
  assert.equal(valid, true, errors.join(' '));
  assert.equal(data.email, 'yog.patil19@gmail.com');
});

test('demo registration: rejects missing fields', () => {
  const { valid, errors } = validateDemoRegistrationInput({});
  assert.equal(valid, false);
  assert.ok(errors.some(e => /First name/.test(e)));
  assert.ok(errors.some(e => /Last name/.test(e)));
  assert.ok(errors.some(e => /email/.test(e)));
  assert.ok(errors.some(e => /phone/i.test(e)));
});

test('demo registration: rejects invalid phone/email same as enrollment', () => {
  const bad = validateDemoRegistrationInput({
    firstName: 'A', lastName: 'B', email: 'not-an-email', phone: '021234'
  });
  assert.equal(bad.valid, false);
});
