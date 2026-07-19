/**
 * api/_lib/calendarInvite.js
 * ---------------------------------------------------------------------------
 * Builds a standards-compliant .ics calendar invite (RFC 5545) for the free
 * demo session, so it can be attached to the confirmation email and opened
 * directly by Gmail/Outlook/Apple Calendar/etc.
 *
 * HONEST LIMITATION on timezones: the admin enters the session's wall-clock
 * date/time (e.g. "10:00 on 3 September 2026") plus a UTC offset (e.g.
 * "+12:00" for New Zealand). This module converts that into an exact UTC
 * instant, which is the only way to get a calendar invite that lands at the
 * correct moment for recipients in other timezones too — a "floating" (no
 * timezone) event would instead be silently reinterpreted in each
 * recipient's own local time, which is wrong for a single fixed live
 * session. What this does NOT do is handle daylight-saving transitions
 * automatically — if your offset changes between when you configure this
 * and the session date (e.g. NZDT vs NZST), double-check the offset you
 * enter is correct for the actual session date.
 */

/**
 * @param {string} dateTimeLocal - "YYYY-MM-DDTHH:mm" wall-clock time (from an <input type="datetime-local">)
 * @param {string} utcOffset - "+HH:mm" or "-HH:mm", e.g. "+12:00"
 * @returns {Date} the precise UTC instant
 */
function localWallTimeToUtcDate(dateTimeLocal, utcOffset) {
  const offsetMatch = /^([+-])(\d{2}):(\d{2})$/.exec(String(utcOffset || '').trim());
  if (!offsetMatch) {
    throw new Error(`Invalid UTC offset "${utcOffset}" — expected format like "+12:00" or "-05:00".`);
  }
  const sign = offsetMatch[1] === '-' ? -1 : 1;
  const offsetMinutes = sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));

  const dtMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(dateTimeLocal || '').trim());
  if (!dtMatch) {
    throw new Error(`Invalid date/time "${dateTimeLocal}" — expected format like "2026-09-03T10:00".`);
  }
  const year = Number(dtMatch[1]), month = Number(dtMatch[2]), day = Number(dtMatch[3]);
  const hour = Number(dtMatch[4]), minute = Number(dtMatch[5]);

  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60000;
  return new Date(utcMillis);
}

function toIcsUtcStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeIcsText(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * @param {object} opts
 * @param {string} opts.dateTimeLocal - "YYYY-MM-DDTHH:mm"
 * @param {string} opts.utcOffset - "+HH:mm"
 * @param {number} [opts.durationMinutes=60]
 * @param {string} opts.summary
 * @param {string} [opts.description]
 * @param {string} [opts.location] - e.g. a Zoom/Meet link
 * @param {string} opts.organizerEmail
 * @param {string} opts.attendeeEmail
 * @param {string} opts.attendeeName
 * @returns {string} the full .ics file contents
 */
function buildDemoSessionIcs(opts) {
  const start = localWallTimeToUtcDate(opts.dateTimeLocal, opts.utcOffset);
  const durationMs = (opts.durationMinutes || 60) * 60000;
  const end = new Date(start.getTime() + durationMs);
  const now = new Date();
  const uid = `demo-session-${start.getTime()}-${Math.random().toString(36).slice(2, 10)}@kiwicraft`;

  const descriptionParts = [opts.description || 'Free Snowflake demo session.'];
  if (opts.location) descriptionParts.push(`Join link: ${opts.location}`);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KiwiCraft//Demo Session//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtcStamp(now)}`,
    `DTSTART:${toIcsUtcStamp(start)}`,
    `DTEND:${toIcsUtcStamp(end)}`,
    `SUMMARY:${escapeIcsText(opts.summary)}`,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join('\n\n'))}`,
  ];
  if (opts.location) lines.push(`LOCATION:${escapeIcsText(opts.location)}`);
  if (opts.organizerEmail) lines.push(`ORGANIZER:mailto:${opts.organizerEmail}`);
  if (opts.attendeeEmail) {
    const cn = opts.attendeeName ? `;CN=${escapeIcsText(opts.attendeeName)}` : '';
    lines.push(`ATTENDEE${cn};RSVP=TRUE:mailto:${opts.attendeeEmail}`);
  }
  lines.push('STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR');

  // RFC 5545 uses CRLF line endings.
  return lines.join('\r\n');
}

module.exports = { buildDemoSessionIcs, localWallTimeToUtcDate, toIcsUtcStamp };
