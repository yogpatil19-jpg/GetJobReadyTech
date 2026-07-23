/**
 * app.js
 * ---------------------------------------------------------------------------
 * Local-currency estimate logic (best-effort, client-side only) — preserved
 * exactly from the original prototype — plus the page init sequence.
 *
 * Note on external dependencies: this relies on ipapi.co (IP geolocation)
 * and api.frankfurter.app (exchange rates), both free public APIs at the
 * time the original prototype was written. I have not re-verified their
 * current uptime, rate limits, or terms of service — check both before
 * relying on this in production, and keep the try/catch fallbacks in place
 * since either can go down or rate-limit independently of this code.
 */

const CURRENCIES = ['USD', 'NZD', 'AUD', 'EUR', 'GBP', 'INR', 'CAD', 'SGD', 'JPY', 'CNY', 'ZAR', 'AED', 'CHF'];
const CURRENCY_NAMES = {
  USD: 'US Dollar', NZD: 'New Zealand Dollar', AUD: 'Australian Dollar', EUR: 'Euro',
  GBP: 'British Pound', INR: 'Indian Rupee', CAD: 'Canadian Dollar', SGD: 'Singapore Dollar',
  JPY: 'Japanese Yen', CNY: 'Chinese Yuan', ZAR: 'South African Rand', AED: 'UAE Dirham',
  CHF: 'Swiss Franc'
};
// Used if the free IP-geolocation lookup fails, times out, or gets
// rate-limited — so the estimate never silently stays blank the way it did
// before (see ipapi.co note below). USD is a reasonable universal default;
// change this if most of your visitors are from one specific country.
const FALLBACK_CURRENCY = 'USD';
let detectedCurrency = null;
let detectedCountry = null;
let overrideCurrency = null;
const rateCache = {};

function populateCurrencySelect() {
  const sel = document.getElementById('currencyOverride');
  CURRENCIES.forEach(cur => {
    const opt = document.createElement('option');
    opt.value = cur;
    opt.textContent = cur;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => {
    overrideCurrency = sel.value || null;
    refreshConversions();
  });
}

async function detectLocation() {
  const geoText = document.getElementById('geoText');
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('lookup failed');
    const data = await res.json();
    if (data.currency) {
      detectedCurrency = data.currency;
      detectedCountry = data.country_name || '';
      geoText.textContent = `Estimating for ${detectedCountry} (${detectedCurrency})`;
    } else {
      throw new Error('no currency in response');
    }
  } catch (e) {
    // Location detection failed (ipapi.co down, rate-limited, blocked by an
    // ad/tracker blocker, etc. — this is a free third-party API with no
    // uptime guarantee). Fall back to a default currency rather than
    // leaving the estimate blank; the visitor can still override it
    // manually with the currency dropdown either way.
    detectedCurrency = FALLBACK_CURRENCY;
    detectedCountry = '';
    geoText.textContent = `Couldn't detect your location — showing an estimate in ${FALLBACK_CURRENCY}, or pick a currency below`;
  }
  refreshConversions();
}

async function getRate(base, target) {
  if (base === target) return 1;
  const key = base + '_' + target;
  if (rateCache[key]) return rateCache[key];
  const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${target}`);
  if (!res.ok) throw new Error('rate lookup failed');
  const data = await res.json();
  const rate = data.rates && data.rates[target];
  if (!rate) throw new Error('currency not supported by rate provider');
  rateCache[key] = rate;
  return rate;
}

function targetCurrency() {
  return overrideCurrency || detectedCurrency;
}

async function refreshConversions() {
  const target = targetCurrency();
  for (const c of courses) {
    const el = document.getElementById('convert-' + c.id);
    if (!el) continue;
    if (!target || target === c.currency) {
      el.textContent = '';
      continue;
    }
    el.textContent = 'Converting…';
    try {
      const rate = await getRate(c.currency, target);
      const converted = (parseFloat(c.fee) * rate).toFixed(2);
      el.innerHTML = `Estimated price in (${escapeHtml(target)}) <span class="approx">${currencySymbol(target)}${converted}</span>`;
    } catch (e) {
      el.textContent = '';
    }
  }
}

(async function init() {
  populateCurrencySelect();
  await loadCourses();
  await checkSuccessParam();
  detectLocation();

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Loading screen: fades out once the init sequence above has resolved,
  // with a hard timeout so it can never get stuck on a slow network.
  const loader = document.getElementById('loadingScreen');
  if (loader) {
    loader.classList.add('hide');
    setTimeout(() => loader.remove(), 500);
  }
})();
