const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDemoSessionIcs, localWallTimeToUtcDate } = require('../api/_lib/calendarInvite');

test('localWallTimeToUtcDate converts NZ time (+12:00) to correct UTC instant', () => {
  const utc = localWallTimeToUtcDate('2026-09-03T10:00', '+12:00');
  assert.equal(utc.toISOString(), '2026-09-02T22:00:00.000Z');
});

test('localWallTimeToUtcDate handles negative offsets (e.g. US Eastern)', () => {
  const utc = localWallTimeToUtcDate('2026-09-03T10:00', '-05:00');
  assert.equal(utc.toISOString(), '2026-09-03T15:00:00.000Z');
});

test('localWallTimeToUtcDate rejects malformed offset', () => {
  assert.throws(() => localWallTimeToUtcDate('2026-09-03T10:00', 'bogus'));
});

test('localWallTimeToUtcDate rejects malformed date', () => {
  assert.throws(() => localWallTimeToUtcDate('not-a-date', '+12:00'));
});

test('buildDemoSessionIcs produces a valid, parseable RFC 5545 structure', () => {
  const ics = buildDemoSessionIcs({
    dateTimeLocal: '2026-09-03T10:00',
    utcOffset: '+12:00',
    durationMinutes: 45,
    summary: 'Free Snowflake Demo Session',
    description: 'Join us for a live walkthrough.',
    location: 'https://meet.google.com/abc-defg-hij',
    organizerEmail: 'training@kiwicraft.co.nz',
    attendeeEmail: 'test@example.com',
    attendeeName: 'Test User'
  });

  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r?\n?$/);
  assert.match(ics, /DTSTART:20260902T220000Z/);
  assert.match(ics, /DTEND:20260902T224500Z/);
  assert.match(ics, /SUMMARY:Free Snowflake Demo Session/);
  assert.match(ics, /LOCATION:https:\/\/meet\.google\.com\/abc-defg-hij/);
  assert.match(ics, /ORGANIZER:mailto:training@kiwicraft\.co\.nz/);
  assert.match(ics, /ATTENDEE;CN=Test User;RSVP=TRUE:mailto:test@example\.com/);
});

test('buildDemoSessionIcs escapes commas, semicolons, and newlines in text fields', () => {
  const ics = buildDemoSessionIcs({
    dateTimeLocal: '2026-09-03T10:00',
    utcOffset: '+12:00',
    summary: 'Demo, Session; Special',
    description: 'Line one\nLine two',
    attendeeEmail: 'test@example.com'
  });
  assert.match(ics, /SUMMARY:Demo\\, Session\\; Special/);
  assert.match(ics, /DESCRIPTION:Line one\\nLine two/);
});

test('buildDemoSessionIcs works without an optional location/organizer', () => {
  const ics = buildDemoSessionIcs({
    dateTimeLocal: '2026-09-03T10:00',
    utcOffset: '+12:00',
    summary: 'Demo Session',
    attendeeEmail: 'test@example.com'
  });
  assert.doesNotMatch(ics, /LOCATION:/);
  assert.doesNotMatch(ics, /ORGANIZER:/);
});
