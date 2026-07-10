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
    geoText.textContent = 'Couldn\'t detect your location — pick a currency to see an estimate';
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
      el.innerHTML = `≈ <span class="approx">${currencySymbol(target)}${converted} ${target}</span> · estimate only`;
    } catch (e) {
      el.textContent = '';
    }
  }
}

(async function init() {
  populateCurrencySelect();
  await loadCourses();
  checkSuccessParam();
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
