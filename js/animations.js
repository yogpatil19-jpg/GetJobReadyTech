/**
 * animations.js
 * ---------------------------------------------------------------------------
 * CSS-driven animation triggers: scroll reveal, animated stat counters,
 * subtle cursor glow. All additive — does not touch course/storage logic.
 * Respects prefers-reduced-motion throughout.
 */

const KCAnimations = (function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let io = null;

  function observeReveals() {
    const els = document.querySelectorAll('.reveal:not(.in)');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('in'));
      return;
    }
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
    }
    els.forEach(el => io.observe(el));
  }

  // Animated counters — numbers below are clearly-labelled placeholders
  // (see index.html "edit before publishing" note). This only animates
  // whatever number is in the markup; it does not invent one.
  function initCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      counters.forEach(el => { el.textContent = el.dataset.counter; });
      return;
    }
    const counterIo = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        counterIo.unobserve(entry.target);
        const el = entry.target;
        const target = el.dataset.counter;
        const numMatch = target.match(/[\d.]+/);
        if (!numMatch) { el.textContent = target; return; }
        const num = parseFloat(numMatch[0]);
        const suffix = target.slice(numMatch.index + numMatch[0].length);
        const prefix = target.slice(0, numMatch.index);
        const duration = 1200;
        const start = performance.now();
        function tick(now) {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          const val = (num * eased).toFixed(numMatch[0].includes('.') ? 1 : 0);
          el.textContent = prefix + val + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    counters.forEach(el => counterIo.observe(el));
  }

  // Subtle cursor glow following the pointer within the hero only —
  // cheap, ambient, and skipped entirely on touch devices / reduced motion.
  function initCursorGlow() {
    if (reduceMotion || matchMedia('(hover: none)').matches) return;
    const hero = document.querySelector('.hero');
    const glow = document.getElementById('cursorGlow');
    if (!hero || !glow) return;
    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      glow.style.setProperty('--gx', (e.clientX - rect.left) + 'px');
      glow.style.setProperty('--gy', (e.clientY - rect.top) + 'px');
      glow.style.opacity = '1';
    });
    hero.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
  }

  return { observeReveals, initCounters, initCursorGlow };
})();

window.KCAnimations = KCAnimations;

document.addEventListener('DOMContentLoaded', () => {
  KCAnimations.observeReveals();
  KCAnimations.initCounters();
  KCAnimations.initCursorGlow();
});
