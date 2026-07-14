/**
 * ui.js
 * ---------------------------------------------------------------------------
 * Chrome around the course logic: settings panel, toast, success overlay
 * (all preserved from the original prototype, same IDs and behavior),
 * plus new additive UI: theme toggle, scroll progress bar, back-to-top.
 */

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// Panel open/close
const overlay = document.getElementById('overlay');
const panel = document.getElementById('panel');
document.getElementById('gearBtn').addEventListener('click', () => {
  overlay.classList.add('open');
  panel.classList.add('open');
});
function closePanel() {
  overlay.classList.remove('open');
  panel.classList.remove('open');
}
document.getElementById('closeBtn').addEventListener('click', closePanel);
overlay.addEventListener('click', closePanel);
document.getElementById('saveBtn').addEventListener('click', () => {
  saveCourses();
  renderCourses();
  refreshConversions();
});

// Success view via ?enrolled=<id>&session_id=<stripe checkout session id>
async function checkSuccessParam() {
  const params = new URLSearchParams(window.location.search);
  const enrolledId = params.get('enrolled');
  const sessionId = params.get('session_id');
  if (!enrolledId) return;

  const course = courses.find(c => c.id === enrolledId);
  const titleEl = document.getElementById('successTitle');
  const textEl = document.getElementById('successText');
  const waBtn = document.getElementById('waBtn');
  const qrImg = document.getElementById('successQr');
  const emailNote = document.getElementById('successEmailNote');

  if (!course) return;

  // No session_id means someone just landed on this URL without actually
  // paying (e.g. an old bookmark) — don't claim payment succeeded.
  if (!sessionId) {
    titleEl.textContent = `Enrollment page — ${course.title}`;
    textEl.textContent = 'We could not verify a payment for this link.';
    waBtn.style.display = 'none';
    qrImg.style.display = 'none';
    document.getElementById('successView').classList.add('open');
    return;
  }

  titleEl.textContent = 'Checking your payment…';
  textEl.textContent = '';
  waBtn.style.display = 'none';
  qrImg.style.display = 'none';
  document.getElementById('successView').classList.add('open');

  try {
    const res = await fetch(`/api/session-status?session_id=${encodeURIComponent(sessionId)}`);
    const data = await res.json();

    if (!res.ok || !data.paid) {
      titleEl.textContent = 'Payment not confirmed yet';
      textEl.textContent = "We couldn't confirm this payment. If you were charged, please contact us with your email address and we'll sort it out.";
      return;
    }

    titleEl.textContent = `You're enrolled in ${data.courseTitle || course.title}`;
    textEl.textContent = data.whatsappLink
      ? 'Tap below to join the course WhatsApp group.'
      : "The WhatsApp link for this course hasn't been added yet — we'll send it to you separately.";

    if (data.whatsappLink) {
      waBtn.href = data.whatsappLink;
      waBtn.style.display = 'inline-block';
    }
    if (data.qrDataUrl) {
      qrImg.src = data.qrDataUrl;
      qrImg.style.display = 'inline-block';
    }
    emailNote.textContent = data.emailSent
      ? `A receipt with this QR code has also been emailed to you.`
      : `Your receipt email is on its way — check your inbox shortly.`;
  } catch (e) {
    console.error('[success] Could not verify session:', e);
    titleEl.textContent = 'Payment received';
    textEl.textContent = "We're finalizing your enrollment — check your email shortly for the WhatsApp link.";
  }
}
document.getElementById('backBtn').addEventListener('click', () => {
  document.getElementById('successView').classList.remove('open');
  window.history.replaceState({}, '', window.location.pathname);
});

/* ---------------------------------------------------------------------
 * Additive UI — none of this touches the IDs or logic above.
 * ------------------------------------------------------------------- */

// Theme toggle (dark default, light optional). Persists via localStorage
// directly — this is a UI preference, not business data, so it doesn't
// go through storage.js.
(function initTheme() {
  const KEY = 'kc-theme';
  const btn = document.getElementById('themeToggle');
  const saved = localStorage.getItem(KEY);
  if (saved === 'light') document.documentElement.classList.add('light');
  updateIcon();

  btn.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem(KEY, document.documentElement.classList.contains('light') ? 'light' : 'dark');
    updateIcon();
  });

  function updateIcon() {
    const isLight = document.documentElement.classList.contains('light');
    btn.innerHTML = isLight ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
  }
})();

// Scroll progress bar
(function initScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.width = max > 0 ? (scrolled / max) * 100 + '%' : '0%';
  }, { passive: true });
})();

// Back-to-top button
(function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 600);
  }, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// Mobile nav toggle
(function initMobileNav() {
  const btn = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => links.classList.remove('open'));
  });
})();

// Newsletter + contact forms — front-end only, no backend wired up yet.
// Clearly labelled so this isn't mistaken for a working submission.
(function initStubForms() {
  const newsletter = document.getElementById('newsletterForm');
  if (newsletter) {
    newsletter.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('Not connected yet — wire this up to your email tool');
    });
  }
  const contact = document.getElementById('contactForm');
  if (contact) {
    contact.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('Not connected yet — wire this up to your inbox or CRM');
    });
  }
})();
