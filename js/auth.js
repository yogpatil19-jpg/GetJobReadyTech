/**
 * auth.js
 * ---------------------------------------------------------------------------
 * Gates the settings panel behind Firebase Authentication (email/password).
 *
 * IMPORTANT: hiding the gear icon here is a UX nicety, not the security
 * boundary. The actual boundary is firestore.rules — anyone with browser
 * devtools could call firebase.firestore() directly and try to write,
 * bypassing this file entirely. Rules are what stop them; this file just
 * keeps normal visitors from seeing an edit panel that isn't for them.
 *
 * Admin accounts are created manually in Firebase Console → Authentication
 * → Users → Add user (or via the Firebase CLI). There's no public sign-up
 * form on this site on purpose — see README.md "Firebase setup".
 */
(function () {
  const gearBtn = document.getElementById('gearBtn');
  const signOutBtn = document.getElementById('adminSignOutBtn');
  const adminTrigger = document.getElementById('adminTrigger');
  const loginOverlay = document.getElementById('adminLoginOverlay');
  const loginModal = document.getElementById('adminLoginModal');
  const loginForm = document.getElementById('adminLoginForm');
  const loginError = document.getElementById('adminLoginError');
  const loginCloseBtn = document.getElementById('adminLoginCloseBtn');

  function showLogin(e) {
    if (e) e.preventDefault();
    if (loginError) loginError.textContent = '';
    if (loginOverlay) loginOverlay.classList.add('open');
    if (loginModal) loginModal.classList.add('open');
  }
  function hideLogin() {
    if (loginOverlay) loginOverlay.classList.remove('open');
    if (loginModal) loginModal.classList.remove('open');
    if (loginForm) loginForm.reset();
  }
  function closeSettingsPanel() {
    const overlay = document.getElementById('overlay');
    const panel = document.getElementById('panel');
    if (overlay) overlay.classList.remove('open');
    if (panel) panel.classList.remove('open');
  }

  if (adminTrigger) adminTrigger.addEventListener('click', showLogin);
  if (loginOverlay) loginOverlay.addEventListener('click', hideLogin);
  if (loginCloseBtn) loginCloseBtn.addEventListener('click', hideLogin);

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!window.__KC_FIREBASE_READY__) {
        loginError.textContent = 'Firebase is not configured yet — see README.md.';
        return;
      }
      const email = document.getElementById('adminEmail').value.trim();
      const password = document.getElementById('adminPassword').value;
      loginError.textContent = '';
      try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        hideLogin();
      } catch (err) {
        // Deliberately generic — don't reveal whether the email exists.
        loginError.textContent = 'Sign-in failed — check your email and password.';
        console.error('[auth] sign-in failed:', err);
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      try {
        await firebase.auth().signOut();
      } catch (err) {
        console.error('[auth] sign-out failed:', err);
      }
      closeSettingsPanel();
    });
  }

  if (window.__KC_FIREBASE_READY__ && typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged((user) => {
      window.__KC_IS_ADMIN__ = !!user;
      if (gearBtn) gearBtn.style.display = user ? '' : 'none';
      if (signOutBtn) signOutBtn.style.display = user ? '' : 'none';
      if (!user) closeSettingsPanel();
    });
  } else {
    console.warn('[auth] Firebase not configured — admin sign-in is disabled until js/firebase-config.js is filled in.');
  }
})();
