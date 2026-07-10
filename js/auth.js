/**
 * auth.js
 * ---------------------------------------------------------------------------
 * Gates the settings panel behind Firebase Authentication + a mandatory
 * phone-based second factor (MFA).
 *
 * ⚠️ ACCURACY NOTE (please read before deploying):
 * The multi-factor calls below (RecaptchaVerifier, PhoneAuthProvider,
 * PhoneMultiFactorGenerator, user.multiFactor.getSession/enroll,
 * getMultiFactorResolver-style error.resolver handling) reflect Firebase's
 * documented MFA API as I understand it, but I have not run this against a
 * live Firebase project, and I have not re-checked it against Firebase's
 * current docs as of your deploy date. Before relying on this:
 *   1. Read https://firebase.google.com/docs/auth/web/multi-factor and
 *      confirm the method names below still match.
 *   2. In Firebase Console → Authentication → Sign-in method, check whether
 *      enabling multi-factor (SMS) requires upgrading your project to the
 *      Blaze (pay-as-you-go) plan / Identity Platform — this has been a
 *      requirement in the past and may still be. SMS sends also cost a
 *      small amount per verification once you're past any free quota.
 *   3. Test the full enroll → sign out → sign in → verify loop yourself
 *      with your real admin account before you rely on it.
 *
 * BREAK-GLASS: you always retain direct access to Firestore Rules and
 * Authentication via the Firebase Console, independent of this site's
 * login flow. If MFA ever misbehaves and locks your admin account out of
 * saving, you can still fix data or adjust firestore.rules directly in the
 * Console with your Google account — that path does not depend on any of
 * the code in this file.
 *
 * SECURITY BOUNDARY REMINDER: everything in this file is UX, not the real
 * boundary. The real boundary is firestore.rules — see the optional
 * "require second factor" rule variant there, which checks the sign-in
 * token itself rather than trusting this file.
 */
(function () {
  const gearBtn = document.getElementById('gearBtn');
  const signOutBtn = document.getElementById('adminSignOutBtn');
  const adminTrigger = document.getElementById('adminTrigger');
  const loginOverlay = document.getElementById('adminLoginOverlay');
  const loginModal = document.getElementById('adminLoginModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const loginCloseBtn = document.getElementById('adminLoginCloseBtn');

  // Step 1: password
  const loginForm = document.getElementById('adminLoginForm');
  const loginError = document.getElementById('adminLoginError');

  // Step 2: first-time enrollment
  const enrollForm = document.getElementById('adminMfaEnrollForm');
  const enrollPhoneStep = document.getElementById('mfaEnrollPhoneStep');
  const enrollPhoneInput = document.getElementById('mfaEnrollPhone');
  const enrollSendBtn = document.getElementById('mfaEnrollSendBtn');
  const enrollCodeStep = document.getElementById('mfaEnrollCodeStep');
  const enrollCodeInput = document.getElementById('mfaEnrollCode');
  const enrollConfirmBtn = document.getElementById('mfaEnrollConfirmBtn');
  const enrollError = document.getElementById('mfaEnrollError');

  // Step 3: challenge on later sign-ins
  const verifyForm = document.getElementById('adminMfaVerifyForm');
  const verifyCodeInput = document.getElementById('mfaVerifyCode');
  const verifyError = document.getElementById('mfaVerifyError');

  let recaptchaVerifier = null;
  let pendingEnrollVerificationId = null;
  let pendingMfaResolver = null;
  let pendingMfaVerificationId = null;

  function showStep(step) {
    [loginForm, enrollForm, verifyForm].forEach(f => { if (f) f.style.display = 'none'; });
    if (step === 'password') { loginForm.style.display = ''; modalTitle.textContent = 'Admin sign-in'; }
    if (step === 'enroll') { enrollForm.style.display = ''; modalTitle.textContent = 'Add a second factor'; }
    if (step === 'verify') { verifyForm.style.display = ''; modalTitle.textContent = 'Verify it\'s you'; }
  }

  function showLogin(e) {
    if (e) e.preventDefault();
    if (loginError) loginError.textContent = '';
    if (enrollError) enrollError.textContent = '';
    if (verifyError) verifyError.textContent = '';
    showStep('password');
    if (loginOverlay) loginOverlay.classList.add('open');
    if (loginModal) loginModal.classList.add('open');
  }
  function hideLogin() {
    if (loginOverlay) loginOverlay.classList.remove('open');
    if (loginModal) loginModal.classList.remove('open');
    if (loginForm) loginForm.reset();
    if (enrollForm) enrollForm.reset();
    if (verifyForm) verifyForm.reset();
    enrollPhoneStep.style.display = '';
    enrollCodeStep.style.display = 'none';
    enrollSendBtn.style.display = '';
    enrollConfirmBtn.style.display = 'none';
    pendingEnrollVerificationId = null;
    pendingMfaResolver = null;
    pendingMfaVerificationId = null;
  }
  function closeSettingsPanel() {
    const overlay = document.getElementById('overlay');
    const panel = document.getElementById('panel');
    if (overlay) overlay.classList.remove('open');
    if (panel) panel.classList.remove('open');
  }

  function getRecaptcha() {
    // Invisible reCAPTCHA, reused across enroll/verify calls in this session.
    if (!recaptchaVerifier) {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptchaContainer', {
        size: 'invisible'
      });
    }
    return recaptchaVerifier;
  }

  if (adminTrigger) adminTrigger.addEventListener('click', showLogin);
  if (loginOverlay) loginOverlay.addEventListener('click', hideLogin);
  if (loginCloseBtn) loginCloseBtn.addEventListener('click', hideLogin);

  // --- Step 1: password sign-in ---------------------------------------
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
        const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
        // Signed in without a second-factor challenge — check whether this
        // account has one enrolled yet.
        const factors = cred.user.multiFactor && cred.user.multiFactor.enrolledFactors;
        if (!factors || factors.length === 0) {
          showStep('enroll');
        } else {
          hideLogin();
        }
      } catch (err) {
        if (err.code === 'auth/multi-factor-auth-required') {
          // Correct password, but a second factor is required — do not
          // treat this as "signed in" yet.
          pendingMfaResolver = err.resolver;
          try {
            const hint = pendingMfaResolver.hints.find(
              h => h.factorId === firebase.auth.PhoneMultiFactorGenerator.FACTOR_ID
            );
            const phoneInfoOptions = { multiFactorHint: hint, session: pendingMfaResolver.session };
            const phoneAuthProvider = new firebase.auth.PhoneAuthProvider();
            pendingMfaVerificationId = await phoneAuthProvider.verifyPhoneNumber(
              phoneInfoOptions, getRecaptcha()
            );
            showStep('verify');
          } catch (mfaErr) {
            console.error('[auth] failed to start MFA challenge:', mfaErr);
            loginError.textContent = 'Could not send verification code — try again.';
          }
        } else {
          // Deliberately generic — don't reveal whether the email exists.
          loginError.textContent = 'Sign-in failed — check your email and password.';
          console.error('[auth] sign-in failed:', err);
        }
      }
    });
  }

  // --- Step 2: first-time enrollment -----------------------------------
  if (enrollSendBtn) {
    enrollSendBtn.addEventListener('click', async () => {
      enrollError.textContent = '';
      const user = firebase.auth().currentUser;
      const phoneNumber = enrollPhoneInput.value.trim();
      if (!user) { enrollError.textContent = 'Session expired — sign in again.'; return; }
      if (!phoneNumber) { enrollError.textContent = 'Enter a phone number, including country code.'; return; }
      try {
        const session = await user.multiFactor.getSession();
        const phoneInfoOptions = { phoneNumber, session };
        const phoneAuthProvider = new firebase.auth.PhoneAuthProvider();
        pendingEnrollVerificationId = await phoneAuthProvider.verifyPhoneNumber(
          phoneInfoOptions, getRecaptcha()
        );
        enrollPhoneStep.style.display = 'none';
        enrollSendBtn.style.display = 'none';
        enrollCodeStep.style.display = '';
        enrollConfirmBtn.style.display = '';
      } catch (err) {
        console.error('[auth] failed to send enrollment code:', err);
        enrollError.textContent = 'Could not send code — check the number and try again.';
      }
    });
  }

  if (enrollConfirmBtn) {
    enrollConfirmBtn.addEventListener('click', async () => {
      enrollError.textContent = '';
      const user = firebase.auth().currentUser;
      const code = enrollCodeInput.value.trim();
      if (!user || !pendingEnrollVerificationId) {
        enrollError.textContent = 'Session expired — sign in again.';
        return;
      }
      try {
        const cred = firebase.auth.PhoneAuthProvider.credential(pendingEnrollVerificationId, code);
        const assertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
        await user.multiFactor.enroll(assertion, 'Admin phone');
        hideLogin();
      } catch (err) {
        console.error('[auth] enrollment failed:', err);
        enrollError.textContent = 'That code didn\'t work — try again.';
      }
    });
  }

  // --- Step 3: challenge on later sign-ins ------------------------------
  if (verifyForm) {
    verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      verifyError.textContent = '';
      const code = verifyCodeInput.value.trim();
      if (!pendingMfaResolver || !pendingMfaVerificationId) {
        verifyError.textContent = 'Session expired — start sign-in again.';
        return;
      }
      try {
        const cred = firebase.auth.PhoneAuthProvider.credential(pendingMfaVerificationId, code);
        const assertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
        await pendingMfaResolver.resolveSignIn(assertion);
        hideLogin();
      } catch (err) {
        console.error('[auth] MFA verification failed:', err);
        verifyError.textContent = 'That code didn\'t work — try again.';
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
      // Only treat the user as "signed in" for UI purposes once they have
      // at least one enrolled second factor — otherwise leave the
      // enrollment step open (handled above) and keep the gear icon hidden.
      const factors = user && user.multiFactor && user.multiFactor.enrolledFactors;
      const fullyAuthed = !!user && !!factors && factors.length > 0;
      window.__KC_IS_ADMIN__ = fullyAuthed;
      if (gearBtn) gearBtn.style.display = fullyAuthed ? '' : 'none';
      if (signOutBtn) signOutBtn.style.display = fullyAuthed ? '' : 'none';
      if (!fullyAuthed) closeSettingsPanel();
    });
  } else {
    console.warn('[auth] Firebase not configured — admin sign-in is disabled until js/firebase-config.js is filled in.');
  }
})();
