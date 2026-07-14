/**
 * firebase-config.js
 * ---------------------------------------------------------------------------
 * Public web config for your Firebase project. Get these values from:
 * Firebase Console → Project settings → General → Your apps → SDK setup and
 * configuration → Config.
 *
 * IS THIS SAFE TO PUBLISH IN CLIENT-SIDE CODE? Yes — Firebase's own docs say
 * this config is not a secret; it just tells the SDK which project to talk
 * to. It does NOT grant read or write access by itself. The real access
 * control lives in two places:
 *   1. firestore.rules (in the project root) — this is what actually decides
 *      who can read/write which documents. Deploy it via the Firebase
 *      Console (Firestore → Rules) or the Firebase CLI.
 *   2. Firebase Authentication — only the specific admin account(s) you
 *      create can sign in and save changes (see js/auth.js).
 * I have not verified this exact reasoning against Firebase's current docs —
 * check https://firebase.google.com/docs/projects/api-keys before you rely
 * on it, since Google's guidance can change.
 *
 * I have not been able to generate real values for you — these are
 * placeholders. The site will not connect to Firebase until you replace
 * every REPLACE_ME_* value below.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCGzuAozvKKJd5riakC4BM-KXiYEjl8rKA",
  authDomain: "getjobreadytech.firebaseapp.com",
  projectId: "getjobreadytech",
  storageBucket: "getjobreadytech.firebasestorage.app",
  messagingSenderId: "444193231489",
  appId: "1:444193231489:web:74414221a2bdf32745b380",
  measurementId: "G-SMV3RRRK76"
};

(function () {
  const isPlaceholder = Object.values(firebaseConfig).some(v => String(v).startsWith('REPLACE_ME'));
  if (isPlaceholder) {
    console.warn(
      '[firebase-config] Placeholder values are still in js/firebase-config.js — ' +
      'the site is running without a real backend until you replace them. ' +
      'See README.md "Firebase setup" for the steps.'
    );
    window.__KC_FIREBASE_READY__ = false;
    return;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    window.__KC_FIREBASE_READY__ = true;
  } catch (e) {
    console.error('[firebase-config] firebase.initializeApp failed:', e);
    window.__KC_FIREBASE_READY__ = false;
  }
})();
