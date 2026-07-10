/**
 * storage.js
 * ---------------------------------------------------------------------------
 * STUB STORAGE LAYER — replace before this matters for real money.
 *
 * The original prototype called `window.storage.get()` / `window.storage.set()`,
 * an API that only exists inside Claude.ai's artifact preview sandbox. It does
 * NOT exist on GitHub Pages, Netlify, Vercel, Firebase Hosting, or S3 — so if
 * this file weren't here, the settings panel would silently stop saving the
 * moment this site is deployed for real.
 *
 * This file defines a drop-in replacement with the exact same shape
 * ({ key, value, shared } / async get / set / delete / list), so nothing in
 * courses.js had to change. Right now it's backed by localStorage, which
 * means:
 *   - Data is per-browser, per-device. It does NOT sync between your laptop
 *     and phone, and does NOT sync between you and a visitor.
 *   - Clearing browser data wipes it.
 *   - There is no real multi-admin or "shared" storage yet — the `shared`
 *     flag is accepted for interface compatibility but not actually shared
 *     across visitors.
 *
 * WHEN YOU'RE READY FOR A REAL BACKEND:
 * Replace the three function bodies below with fetch() calls to your own
 * API (or a service like Supabase/Firebase Firestore). Keep the return
 * shape identical and the rest of the site keeps working unchanged.
 * I have not verified specific SDK method names for any provider you might
 * pick — check that provider's current docs before wiring it in.
 */
(function () {
  const PREFIX = 'kc-stub::';

  function readAll() {
    try {
      const raw = localStorage.getItem(PREFIX + '__all__');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(all) {
    localStorage.setItem(PREFIX + '__all__', JSON.stringify(all));
  }

  async function get(key /*, shared */) {
    const all = readAll();
    if (!(key in all)) return null;
    return { key, value: all[key], shared: false };
  }

  async function set(key, value /*, shared */) {
    const all = readAll();
    all[key] = value;
    writeAll(all);
    return { key, value, shared: false };
  }

  async function del(key /*, shared */) {
    const all = readAll();
    const existed = key in all;
    delete all[key];
    writeAll(all);
    return { key, deleted: existed, shared: false };
  }

  async function list(prefix /*, shared */) {
    const all = readAll();
    const keys = Object.keys(all).filter(k => !prefix || k.startsWith(prefix));
    return { keys, prefix, shared: false };
  }

  // Only define it if it isn't already provided by the host environment
  // (e.g. when this file is previewed inside a Claude artifact sandbox).
  if (!window.storage) {
    window.storage = { get, set, delete: del, list };
    window.__KC_STORAGE_IS_STUB__ = true;
  }
})();
