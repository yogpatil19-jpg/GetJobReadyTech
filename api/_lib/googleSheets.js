/**
 * api/_lib/googleSheets.js
 * ---------------------------------------------------------------------------
 * Appends a row to a Google Sheet using a service account (no user OAuth
 * flow needed — the sheet just needs to be shared with the service
 * account's email address, see README.md "Enrollment backend setup").
 *
 * Required environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_KEY  — full service account JSON key, as a string
 *   GOOGLE_SHEETS_SPREADSHEET_ID — the ID from the sheet's URL
 *     (https://docs.google.com/spreadsheets/d/THIS_PART/edit)
 *
 * You can reuse the same service account as Firebase Admin
 * (FIREBASE_SERVICE_ACCOUNT_KEY) if it's in the same GCP project and you've
 * enabled the Google Sheets API for that project — or use a separate one.
 * Either way, that service account's email must be added as an Editor on
 * the target spreadsheet (Share button → paste the service account email).
 *
 * I have not run this against a live spreadsheet — verify the `googleapis`
 * auth/sheets call shape against
 * https://developers.google.com/sheets/api/quickstart/nodejs before relying
 * on it, and do a real test append before going live.
 */
const { google } = require('googleapis');

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set.');
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.');
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

/**
 * Appends one row. Sheet tab name defaults to "Enrollments" — create that
 * tab in your spreadsheet (or change SHEET_TAB below / pass a different
 * one) before going live.
 */
async function appendEnrollmentRow(row, sheetTab = 'Enrollments') {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set.');

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetTab}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
}

module.exports = { appendEnrollmentRow };
