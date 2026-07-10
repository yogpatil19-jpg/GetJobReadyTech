/**
 * storage.js
 * ---------------------------------------------------------------------------
 * Firestore-backed storage layer. Same drop-in shape as before
 * ({ key, value, shared } / async get / set / delete / list), so courses.js
 * did not need to change.
 *
 * WHAT'S SHARED VS. LOCAL: every key here now lives in Firestore, in the
 * `site-config` collection, one document per key. All visitors read the
 * same document on every page load — that's the point (config no longer
 * lives in the page source or in one browser's localStorage).
 *
 * WHO CAN WRITE: this file does NOT decide that. Firestore Security Rules
 * (firestore.rules, deployed separately in the Firebase Console or CLI)
 * are the actual gatekeeper — they reject any write that isn't from a
 * signed-in admin account, regardless of what this client-side code does.
 * The check in set()/delete() below is just a fast, friendly error message;
 * removing it would not weaken security, and the rules alone are what
 * actually protects the data.
 *
 * If js/firebase-config.js hasn't been filled in yet (window.__KC_FIREBASE_READY__
 * is false), every call here rejects with a clear error rather than silently
 * falling back to a fake local store — I did not want a half-configured
 * backend to look like it was working when it wasn't.
 *
 * I have not re-verified the current firebase.firestore() compat SDK method
 * names against Firebase's live docs as of your deploy date — double-check
 * https://firebase.google.com/docs/firestore/quickstart before relying on
 * this in production, in case the API has moved on since this was written.
 */
(function () {
  const COLLECTION = 'site-config';

  function requireFirestore() {
    if (!window.__KC_FIREBASE_READY__ || typeof firebase === 'undefined') {
      throw new Error(
        'Firebase is not configured yet — fill in js/firebase-config.js (see README.md).'
      );
    }
    return firebase.firestore();
  }

  function requireAdmin() {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('You must be signed in as admin to make changes.');
    }
    return user;
  }

  async function get(key /*, shared */) {
    const db = requireFirestore();
    const snap = await db.collection(COLLECTION).doc(key).get();
    if (!snap.exists) return null;
    const data = snap.data();
    return { key, value: data.value, shared: true };
  }

  async function set(key, value /*, shared */) {
    const db = requireFirestore();
    const user = requireAdmin();
    await db.collection(COLLECTION).doc(key).set({
      value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: user.uid
    });
    return { key, value, shared: true };
  }

  async function del(key /*, shared */) {
    const db = requireFirestore();
    requireAdmin();
    const ref = db.collection(COLLECTION).doc(key);
    const existed = (await ref.get()).exists;
    await ref.delete();
    return { key, deleted: existed, shared: true };
  }

  async function list(prefix /*, shared */) {
    const db = requireFirestore();
    const snap = await db.collection(COLLECTION).get();
    const keys = [];
    snap.forEach(doc => {
      if (!prefix || doc.id.startsWith(prefix)) keys.push(doc.id);
    });
    return { keys, prefix, shared: true };
  }

  window.storage = { get, set, delete: del, list };
})();
