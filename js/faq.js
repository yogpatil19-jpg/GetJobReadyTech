/**
 * faq.js
 * ---------------------------------------------------------------------------
 * The FAQ uses native <details>/<summary>, which gives free keyboard support
 * and accessibility without any JS. This file only adds one small courtesy:
 * closing other open FAQ items when a new one opens, so the list doesn't
 * grow to an awkward length. No animation library needed — the open/close
 * transition itself is handled in animations.css.
 */
(function () {
  const items = document.querySelectorAll('.faq details');
  items.forEach(item => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        items.forEach(other => {
          if (other !== item) other.open = false;
        });
      }
    });
  });
})();
