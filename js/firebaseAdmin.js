/**
 * api/_lib/firebaseAdmin.js
 * ---------------------------------------------------------------------------
 * Server-side Firebase Admin SDK — only ever imported by files under /api.
 * NEVER import this from client-side code (js/*.js served to the browser) —
 * it holds full read/write access to Firestore, bypassing every rule in
 * firestore.rules by design (that's what "Admin" SDK means).
 *
 * Requires the FIREBASE_SERVICE_ACCOUNT_KEY environment variable — the full
 * JSON key for a Firebase service account, stored as a single-line string
 * (see README.md "Enrollment backend setup" for how to generate one).
 * Set it in Vercel: Project → Settings → Environment Variables.
 *
 * I have not run this against a live Firebase project — verify the
 * `firebase-admin` initializeApp/credential.cert call shape against
 * https://firebase.google.com/docs/admin/setup before relying on it.
 */
const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY is not set — add it in Vercel → Project → Settings → Environment Variables.'
    );
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON — paste the full service account key file contents as-is.');
  }

  // Very common failure mode: when a service-account JSON's private_key
  // field is pasted into a platform's env var UI (Vercel, etc.), the
  // literal "\n" sequences inside it can end up double-escaped ("\\n") or
  // otherwise mangled, which breaks PEM parsing with an error like
  // "Failed to parse private key: Error: Invalid PEM formatted message."
  // Normalizing here makes this resilient either way.
  if (serviceAccount && typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error('[firebaseAdmin] admin.credential.cert failed:', e.message);
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY parsed as JSON but the private key is malformed — re-copy the key file contents into Vercel exactly as downloaded.');
  }
}

function getDb() {
  getAdminApp();
  return admin.firestore();
}

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

module.exports = { getAdminApp, getDb, serverTimestamp };
