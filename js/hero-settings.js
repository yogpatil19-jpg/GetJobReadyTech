/**
 * hero-settings.js
 * ---------------------------------------------------------------------------
 * Admin-configurable content for the event-style hero banner (eyebrow,
 * headline, tagline, city/date badge for the demo session), plus a flag to
 * hide the "Choose Your Track" courses section entirely, and the on-page
 * demo-session registration form (first/last name, email, phone).
 *
 * Content is stored in Firestore via the same window.storage.get/set used
 * everywhere else, under its own key — reuses the existing
 * admin-auth-gated save path.
 *
 * The registration form submits to /api/demo-registration (a new, minimal
 * serverless function — see that file's header comment). It only stores
 * the lead in Firestore right now; it does not send a confirmation email
 * or sync to Google Sheets the way paid enrollments do. If you want that
 * too, say so and it can be added the same way the enrollment flow was.
 */
const HERO_SETTINGS_KEY = 'site-hero-settings-v1';

const defaultHeroSettings = {
  brandText: 'SNOWFLAKE TRAINING',
  eyebrow: 'SNOWFLAKE TRAINING · FREE DEMO SESSION',
  title: 'FREE SNOWFLAKE\nDEMO SESSION',
  tagline: 'MAKING YOU JOB-READY, FASTER',
  city: 'ONLINE',
  date: 'DATE TO BE ANNOUNCED',
  hideChooseTrack: false,
  // Hero call-to-action buttons. These replaced the single combined
  // "See course details & enroll" link, so both default to true —
  // settings saved before this existed keep showing both buttons.
  showDetailsButton: true,
  showEnrollButton: true,
  // Formatted course-details copy shown by the "See course details"
  // button. Stored as a restricted subset of HTML (see sanitizeRichHtml)
  // and authored with the small rich-text editor in the config panel.
  courseDetailsHtml: '',
  demoDateTime: '',       // "YYYY-MM-DDTHH:mm" wall-clock time, e.g. "2026-09-03T10:00"
  demoUtcOffset: '+12:00', // e.g. "+12:00" for NZ — used to convert demoDateTime to exact UTC for the calendar invite
  demoTimezoneLabel: 'NZST', // shown in the email text, purely cosmetic
  demoDurationMinutes: 60,
  calendarInviteLink: '',   // Zoom/Meet/Teams link included in the invite and email
  whatsappGroupLink: ''     // WhatsApp group invite link for demo-session registrants
};

/** The brand label used before it was shortened. Any saved settings still
 *  holding this exact value are transparently upgraded to the new label, so
 *  the header doesn't keep showing the old text from Firestore. */
const LEGACY_BRAND_TEXT = 'KIWICRAFT // SNOWFLAKE TRAINING';

let heroSettings = { ...defaultHeroSettings };

/* -------------------------------------------------------------------------
 * Rich-text sanitizing
 * -----------------------------------------------------------------------
 * courseDetailsHtml is the one field on this page stored as HTML rather
 * than plain text, and it gets written into the DOM with innerHTML. Only
 * authenticated admins can save it (see firestore.rules), but that is an
 * authorization control, not an output-encoding one — a compromised admin
 * account, or anyone who ever gains write access to that document, would
 * otherwise have a stored-XSS primitive against every visitor.
 *
 * So the markup is reduced to a fixed allow-list of formatting tags, and
 * that reduction runs on BOTH save and render. Rendering is the load-
 * bearing pass: it protects visitors even against content that was stored
 * before this code existed, or written directly into Firestore.
 *
 * DOMParser is used deliberately — it builds an inert document, so nothing
 * executes and no image/network fetch fires while we inspect the tree.
 */
const RICH_TEXT_ALLOWED_TAGS = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI',
  'H3', 'H4', 'BLOCKQUOTE', 'A'
]);

/** Dropped outright, content and all, rather than unwrapped. */
const RICH_TEXT_DROP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META',
  'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'SVG', 'MATH'
]);

function sanitizeRichHtml(html) {
  if (!html || typeof html !== 'string') return '';
  const doc = new DOMParser().parseFromString(
    '<div id="kc-rt-root">' + html + '</div>', 'text/html'
  );
  const root = doc.getElementById('kc-rt-root');
  if (!root) return '';
  sanitizeRichNode(root);
  return root.innerHTML.trim();
}

function sanitizeRichNode(node) {
  // Snapshot the child list — the loop mutates it.
  Array.from(node.childNodes).forEach(child => {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return; // text nodes pass through

    const tag = child.tagName.toUpperCase();

    if (RICH_TEXT_DROP_TAGS.has(tag)) {
      child.remove();
      return;
    }

    sanitizeRichNode(child); // depth-first, so unwrapping can't skip descendants

    if (!RICH_TEXT_ALLOWED_TAGS.has(tag)) {
      unwrapElement(child); // keep the text, discard the tag (e.g. <div>, <span>, <font>)
      return;
    }

    // Strip every attribute, then re-add only the handful that are safe.
    // This drops style, class, id, and critically all on* handlers.
    Array.from(child.attributes).forEach(attr => {
      const keep = tag === 'A' && attr.name.toLowerCase() === 'href';
      if (!keep) child.removeAttribute(attr.name);
    });

    if (tag === 'A') {
      const href = (child.getAttribute('href') || '').trim();
      // Allow-list the scheme so javascript: and data: URLs can't survive.
      if (!/^(https?:\/\/|mailto:|#)/i.test(href)) {
        child.removeAttribute('href');
      }
      child.setAttribute('target', '_blank');
      child.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

function unwrapElement(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/** True when the rich text is empty once tags and whitespace are discounted. */
function richTextIsEmpty(html) {
  const clean = sanitizeRichHtml(html);
  if (!clean) return true;
  const doc = new DOMParser().parseFromString('<div id="p">' + clean + '</div>', 'text/html');
  const el = doc.getElementById('p');
  return !el || !el.textContent.replace(/\u00a0/g, ' ').trim();
}

async function loadHeroSettings() {
  try {
    const res = await window.storage.get(HERO_SETTINGS_KEY, true);
    heroSettings = res && res.value ? { ...defaultHeroSettings, ...JSON.parse(res.value) } : { ...defaultHeroSettings };
  } catch (e) {
    console.warn('[hero-settings] Falling back to defaults — Firestore read failed:', e);
    heroSettings = { ...defaultHeroSettings };
  }
  applyHeroSettings();
  renderHeroSettingsForm();
}

function applyHeroSettings() {
  const brandTextEl = document.getElementById('siteBrandText');
  const eyebrowEl = document.getElementById('heroEyebrow');
  const titleEl = document.getElementById('heroTitle');
  const taglineEl = document.getElementById('heroTagline');
  const cityEl = document.getElementById('heroCity');
  const dateEl = document.getElementById('heroDate');

  if (!heroSettings.brandText || heroSettings.brandText.trim() === LEGACY_BRAND_TEXT) {
    heroSettings.brandText = defaultHeroSettings.brandText;
  }

  if (brandTextEl) brandTextEl.textContent = heroSettings.brandText;
  if (eyebrowEl) eyebrowEl.textContent = heroSettings.eyebrow;
  if (titleEl) titleEl.innerHTML = escapeHtml(heroSettings.title).replace(/\n/g, '<br>');
  if (taglineEl) taglineEl.textContent = heroSettings.tagline;
  if (cityEl) cityEl.textContent = heroSettings.city;
  if (dateEl) dateEl.textContent = heroSettings.date;

  applyHeroCtaSettings();
  updateSectionVisibility();
}

/**
 * Shows/hides the two hero buttons and loads the course-details modal.
 * Both flags are compared with `!== false` so older saved settings, which
 * have neither key, behave as "show both" rather than hiding the CTAs.
 */
function applyHeroCtaSettings() {
  const showDetails = heroSettings.showDetailsButton !== false;
  const showEnroll = heroSettings.showEnrollButton !== false;

  const detailsBtn = document.getElementById('heroDetailsBtn');
  const enrollBtn = document.getElementById('heroEnrollBtn');
  const ctaRow = document.getElementById('heroCtaRow');

  if (detailsBtn) detailsBtn.style.display = showDetails ? '' : 'none';
  if (enrollBtn) enrollBtn.style.display = showEnroll ? '' : 'none';
  if (ctaRow) ctaRow.style.display = (showDetails || showEnroll) ? '' : 'none';

  const body = document.getElementById('courseDetailsBody');
  if (body) {
    body.innerHTML = richTextIsEmpty(heroSettings.courseDetailsHtml)
      ? '<p class="rich-text-empty">Course details haven\u2019t been added yet.</p>'
      : sanitizeRichHtml(heroSettings.courseDetailsHtml);
  }

  // The on-page course-details section is tied to the same checkbox as the
  // button that scrolls to it — one control, so the page can never show a
  // details section with no way to reach it, or a button pointing at a
  // section that isn't there.
  const section = document.getElementById('course-details');
  if (section) section.style.display = showDetails ? '' : 'none';

  // The section's own enroll button follows the enrollment flag, so hiding
  // enrollment hides every route to it.
  const foot = document.getElementById('courseDetailsFoot');
  if (foot) foot.style.display = showEnroll ? '' : 'none';
}

/**
 * Decides whether the "Choose Your Track" (#courses) and FAQ (#faq)
 * sections should be visible. Hidden when EITHER:
 *   - the admin manually checked "Hide the Choose Your Track section", OR
 *   - no course currently has its "Show this course on the website"
 *     checkbox checked (see js/courses.js — course.enabled).
 * Called after both course data and hero settings have loaded — from
 * whichever of js/courses.js / js/hero-settings.js finishes loading last,
 * since either order is possible depending on network timing.
 */
function updateSectionVisibility() {
  const coursesSection = document.getElementById('courses');
  const faqSection = document.getElementById('faq');
  const coursesNavLink = document.querySelector('.nav-links a[href="#courses"]');
  const faqNavLink = document.querySelector('.nav-links a[href="#faq"]');

  // `courses` is the shared global list from js/courses.js (both files are
  // classic, non-module scripts, so a top-level `let` there is directly
  // visible here by name — but note it would NOT show up as
  // `window.courses`, since `let`/`const` don't attach to `window` the way
  // `var` does). Guarded with typeof in case this ever runs before
  // courses.js has executed.
  const anyCourseEnabled = typeof courses !== 'undefined' && Array.isArray(courses)
    ? courses.some(c => c.enabled !== false)
    : true; // assume visible until we know otherwise, to avoid a flash of hidden content

  const shouldHide = heroSettings.hideChooseTrack || !anyCourseEnabled;

  if (coursesSection) coursesSection.style.display = shouldHide ? 'none' : '';
  if (faqSection) faqSection.style.display = shouldHide ? 'none' : '';
  if (coursesNavLink) coursesNavLink.style.display = shouldHide ? 'none' : '';
  if (faqNavLink) faqNavLink.style.display = shouldHide ? 'none' : '';
}
window.KCUpdateSectionVisibility = updateSectionVisibility;

async function saveHeroSettings() {
  try {
    await window.storage.set(HERO_SETTINGS_KEY, JSON.stringify(heroSettings), true);
    applyHeroSettings();
    if (typeof showToast === 'function') showToast('Saved');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Save failed — try again');
  }
}

function renderHeroSettingsForm() {
  const container = document.getElementById('heroSettingsForm');
  if (!container) return;
  container.innerHTML = `
    <div class="field">
      <label>Site brand text (top-left header logo)</label>
      <input id="hs-brandText" value="${escapeAttr(heroSettings.brandText)}">
    </div>
    <div class="field">
      <label>Eyebrow label (small text above headline)</label>
      <input id="hs-eyebrow" value="${escapeAttr(heroSettings.eyebrow)}">
    </div>
    <div class="field">
      <label>Headline <span class="field-hint">(press Enter for a line break, like the reference banner)</span></label>
      <textarea id="hs-title" rows="2">${escapeHtml(heroSettings.title)}</textarea>
    </div>
    <div class="field">
      <label>Tagline</label>
      <input id="hs-tagline" value="${escapeAttr(heroSettings.tagline)}">
    </div>
    <div class="row2">
      <div class="field">
        <label>City / location badge (top line)</label>
        <input id="hs-city" value="${escapeAttr(heroSettings.city)}">
      </div>
      <div class="field">
        <label>Demo session date (bottom line)</label>
        <input id="hs-date" placeholder="e.g. 3 SEPTEMBER 2026" value="${escapeAttr(heroSettings.date)}">
      </div>
    </div>
    <label class="checkbox-row">
      <input type="checkbox" id="hs-hideChooseTrack" ${heroSettings.hideChooseTrack ? 'checked' : ''}>
      <span>Hide the "Choose Your Track" courses section from the page</span>
    </label>

    <h5 class="panel-subhead" style="margin-top:20px;border-top:none;padding-top:0;">Hero buttons</h5>
    <div class="row2">
      <label class="checkbox-row">
        <input type="checkbox" id="hs-showDetailsButton" ${heroSettings.showDetailsButton !== false ? 'checked' : ''}>
        <span>Show "See course details" button <span class="field-hint">— also shows/hides the "Course details" section itself</span></span>
      </label>
      <label class="checkbox-row">
        <input type="checkbox" id="hs-showEnrollButton" ${heroSettings.showEnrollButton !== false ? 'checked' : ''}>
        <span>Show "Enroll for course" button</span>
      </label>
    </div>

    <div class="field rt-field" id="hs-courseDetailsField">
      <label>
        Course details
        <span class="field-hint">(the "Course details" section on the page, which the "See course details" button scrolls to — use the buttons below to format it)</span>
      </label>
      <div class="rt-toolbar" role="toolbar" aria-label="Course details formatting">
        <button type="button" class="rt-btn" data-rt-cmd="bold" title="Bold" aria-label="Bold"><i class="fa-solid fa-bold"></i></button>
        <button type="button" class="rt-btn" data-rt-cmd="italic" title="Italic" aria-label="Italic"><i class="fa-solid fa-italic"></i></button>
        <button type="button" class="rt-btn" data-rt-cmd="underline" title="Underline" aria-label="Underline"><i class="fa-solid fa-underline"></i></button>
        <span class="rt-sep" aria-hidden="true"></span>
        <button type="button" class="rt-btn" data-rt-cmd="formatBlock" data-rt-value="h3" title="Heading" aria-label="Heading"><i class="fa-solid fa-heading"></i></button>
        <button type="button" class="rt-btn" data-rt-cmd="insertUnorderedList" title="Bulleted list" aria-label="Bulleted list"><i class="fa-solid fa-list-ul"></i></button>
        <button type="button" class="rt-btn" data-rt-cmd="insertOrderedList" title="Numbered list" aria-label="Numbered list"><i class="fa-solid fa-list-ol"></i></button>
        <span class="rt-sep" aria-hidden="true"></span>
        <button type="button" class="rt-btn" data-rt-cmd="createLink" title="Add link" aria-label="Add link"><i class="fa-solid fa-link"></i></button>
        <button type="button" class="rt-btn" data-rt-cmd="removeFormat" title="Clear formatting" aria-label="Clear formatting"><i class="fa-solid fa-eraser"></i></button>
        <span class="rt-sep" aria-hidden="true"></span>
        <button type="button" class="rt-btn rt-btn-wide" data-rt-cmd="starter"
                title="Insert a starter outline (only when the field is empty)">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Starter outline
        </button>
      </div>
      <div class="rt-editor rich-text rich-text-compact" id="hs-courseDetailsEditor" contenteditable="true"
           role="textbox" aria-multiline="true" aria-label="Course details rich text"></div>
      <span class="field-hint rt-note">Formatting is limited to headings, bold, italic, underline, lists, and links — anything else is stripped when saved.</span>
    </div>

    <h5 class="panel-subhead" style="margin-top:20px;border-top:none;padding-top:0;">Calendar invite (for demo registrations)</h5>
    <div class="row2">
      <div class="field">
        <label>Session date &amp; time <span class="field-hint">(the exact wall-clock time — used to build the calendar invite, separate from the display badge above)</span></label>
        <input type="datetime-local" id="hs-demoDateTime" value="${escapeAttr(heroSettings.demoDateTime)}">
      </div>
      <div class="field">
        <label>UTC offset <span class="field-hint">(e.g. "+12:00" for NZ — must be correct or the invite will land at the wrong time)</span></label>
        <input id="hs-demoUtcOffset" placeholder="+12:00" value="${escapeAttr(heroSettings.demoUtcOffset)}">
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label>Timezone label <span class="field-hint">(shown in the email text only, e.g. "NZST")</span></label>
        <input id="hs-demoTimezoneLabel" value="${escapeAttr(heroSettings.demoTimezoneLabel)}">
      </div>
      <div class="field">
        <label>Duration (minutes)</label>
        <input type="number" min="15" step="15" id="hs-demoDurationMinutes" value="${escapeAttr(heroSettings.demoDurationMinutes)}">
      </div>
    </div>
    <div class="field">
      <label>Calendar invite / join link <span class="field-hint">(Zoom, Google Meet, Teams — included in the invite and confirmation email)</span></label>
      <input id="hs-calendarInviteLink" placeholder="https://meet.google.com/..." value="${escapeAttr(heroSettings.calendarInviteLink)}">
    </div>
    <div class="field">
      <label>WhatsApp group link (for demo registrants) <span class="field-hint">(included as a link and a QR code in the confirmation email)</span></label>
      <input id="hs-whatsappGroupLink" placeholder="https://chat.whatsapp.com/..." value="${escapeAttr(heroSettings.whatsappGroupLink)}">
    </div>
    <div class="field">
      <label class="field-hint">Leave "Session date &amp; time" blank to skip attaching a calendar invite — registrants will still get a confirmation email without one.</label>
    </div>
  `;
  initCourseDetailsEditor();

  container.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => {
      if (el.type === 'checkbox') {
        const checkboxMap = {
          'hs-hideChooseTrack': 'hideChooseTrack',
          'hs-showDetailsButton': 'showDetailsButton',
          'hs-showEnrollButton': 'showEnrollButton'
        };
        const cbKey = checkboxMap[el.id];
        if (cbKey) heroSettings[cbKey] = el.checked;
        updateCourseDetailsFieldVisibility();
        return;
      }
      const map = {
        'hs-brandText': 'brandText',
        'hs-eyebrow': 'eyebrow', 'hs-title': 'title', 'hs-tagline': 'tagline',
        'hs-city': 'city', 'hs-date': 'date',
        'hs-demoDateTime': 'demoDateTime', 'hs-demoUtcOffset': 'demoUtcOffset',
        'hs-demoTimezoneLabel': 'demoTimezoneLabel', 'hs-demoDurationMinutes': 'demoDurationMinutes',
        'hs-calendarInviteLink': 'calendarInviteLink', 'hs-whatsappGroupLink': 'whatsappGroupLink'
      };
      const key = map[el.id];
      if (key) heroSettings[key] = el.value;
    });
  });
}

// --- Course details rich-text editor (config panel) ------------------------

/**
 * Starting skeleton offered by the "Starter outline" toolbar button.
 *
 * It exists because the section only looks considered when the copy has
 * shape — a lead paragraph, then headed blocks, then lists. Handed an empty
 * box, it is easy to paste in one long wall of text, which no amount of CSS
 * rescues. The placeholders are meant to be replaced, not kept.
 *
 * Deliberately uses only tags on RICH_TEXT_ALLOWED_TAGS, and is passed
 * through the sanitizer like any other input rather than trusted.
 */
const COURSE_DETAILS_STARTER = [
  '<p>One or two sentences on who this course is for and what they will be able to do by the end. This opening paragraph is styled as a lead, so keep it short and concrete.</p>',
  '<h3>What you will learn</h3>',
  '<ul>',
  '<li>Replace each line with a specific, demonstrable outcome</li>',
  '<li>Lead with the verb — "Configure role hierarchies", not "Understanding of roles"</li>',
  '<li>Four to six lines reads best here</li>',
  '</ul>',
  '<h3>Who this is for</h3>',
  '<ul>',
  '<li>The role or job title this is aimed at</li>',
  '<li>The level of experience assumed</li>',
  '</ul>',
  '<h3>Prerequisites</h3>',
  '<p>What someone needs before day one, or state plainly that none are required.</p>',
  '<h3>How the course runs</h3>',
  '<ol>',
  '<li>Format — live sessions, recordings, or both</li>',
  '<li>Duration and schedule</li>',
  '<li>What is included: labs, materials, support channel</li>',
  '</ol>',
  '<blockquote><p>Use a callout like this for the single most important thing a prospective student should know — a certification covered, a hiring outcome, or a cohort start date.</p></blockquote>'
].join('');

/**
 * Wires the small contenteditable editor and its toolbar.
 *
 * document.execCommand is formally deprecated, but it is still the only
 * thing every current browser implements for this, and there is no
 * replacement API. The alternative was pulling in an editor library,
 * which this project deliberately avoids — it has no build step, and the
 * CSP only allows scripts from 'self' plus two pinned CDNs. If execCommand
 * is ever dropped, the field degrades to plain typing, which still works:
 * the text is preserved, only the formatting buttons stop responding.
 */
function initCourseDetailsEditor() {
  const editor = document.getElementById('hs-courseDetailsEditor');
  const toolbar = document.querySelector('#hs-courseDetailsField .rt-toolbar');
  if (!editor) return;

  // Seeded via innerHTML on purpose — this is stored markup, not user text,
  // and it is sanitized on the way in.
  editor.innerHTML = sanitizeRichHtml(heroSettings.courseDetailsHtml);

  const sync = () => {
    heroSettings.courseDetailsHtml = sanitizeRichHtml(editor.innerHTML);
  };
  editor.addEventListener('input', sync);
  editor.addEventListener('blur', sync);

  // Paste as plain text, so copying from Word or a web page can't drag in
  // font tags, inline styles, or a tracking pixel.
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
    sync();
  });

  if (toolbar) {
    toolbar.querySelectorAll('.rt-btn').forEach(btn => {
      // mousedown/preventDefault keeps the caret and selection inside the
      // editor — without it, clicking the button blurs the editor first and
      // the command applies to nothing.
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.rtCmd;
        editor.focus();

        if (cmd === 'starter') {
          // Refuses to overwrite rather than asking, so a stray click can
          // never destroy copy that took a while to write.
          if (!richTextIsEmpty(editor.innerHTML)) {
            if (typeof showToast === 'function') showToast('Clear the field first to insert the outline');
            return;
          }
          editor.innerHTML = sanitizeRichHtml(COURSE_DETAILS_STARTER);
          sync();
          return;
        }

        if (cmd === 'createLink') {
          const url = window.prompt('Link URL (https://… or mailto:…)');
          if (!url) return;
          if (!/^(https?:\/\/|mailto:|#)/i.test(url.trim())) {
            if (typeof showToast === 'function') showToast('Only https://, mailto:, or # links are allowed');
            return;
          }
          document.execCommand('createLink', false, url.trim());
        } else if (cmd === 'formatBlock') {
          // Toggle: pressing Heading inside a heading returns it to a paragraph.
          const inHeading = document.queryCommandValue('formatBlock').toLowerCase() === (btn.dataset.rtValue || 'h3');
          document.execCommand('formatBlock', false, inHeading ? 'p' : (btn.dataset.rtValue || 'h3'));
        } else {
          document.execCommand(cmd, false, null);
        }
        sync();
      });
    });
  }

  updateCourseDetailsFieldVisibility();
}

/**
 * The course-details editor is only shown when BOTH hero buttons are
 * enabled, as requested: the copy is reached through "See course details"
 * and its call to action is "Enroll for course", so it is only useful when
 * both of those exist.
 */
function updateCourseDetailsFieldVisibility() {
  const field = document.getElementById('hs-courseDetailsField');
  if (!field) return;
  const detailsCb = document.getElementById('hs-showDetailsButton');
  const enrollCb = document.getElementById('hs-showEnrollButton');
  const bothOn = !!(detailsCb && detailsCb.checked && enrollCb && enrollCb.checked);
  field.style.display = bothOn ? '' : 'none';
}

// --- Course details section (public page) ----------------------------------

/**
 * "See course details" is a plain #course-details anchor, so it already
 * works without JavaScript — the browser jumps to the section, smoothly
 * because html{scroll-behavior:smooth} is set in css/style.css.
 *
 * This only adds the part the browser does not do well: moving keyboard
 * focus along with the scroll. Following a same-page anchor scrolls the
 * viewport but leaves focus behind on the link, so a keyboard or screen
 * reader user would still be up in the hero. Focusing the section heading
 * (tabindex="-1") brings the caret with the view.
 */
function initCourseDetailsSection() {
  const btn = document.getElementById('heroDetailsBtn');
  const heading = document.getElementById('courseDetailsHeading');
  if (!btn || !heading) return;

  btn.addEventListener('click', () => {
    // Deferred so focusing happens after the browser starts the jump —
    // focusing first would make it scroll twice, fighting the smooth scroll.
    window.setTimeout(() => heading.focus({ preventScroll: true }), 400);
  });
}

// --- Demo session registration form (in the hero card) ---------------------

function populateHeroDemoCountryCodes() {
  const select = document.getElementById('heroDemoCountryCode');
  if (!select || !window.KC_COUNTRY_CODES) return;
  select.innerHTML = window.KC_COUNTRY_CODES
    .map(c => `<option value="${c.dial}">${c.dial} ${c.name}</option>`)
    .join('');
  const nz = window.KC_COUNTRY_CODES.findIndex(c => c.iso === 'NZ');
  select.selectedIndex = nz >= 0 ? nz : 0;
}

function initHeroDemoForm() {
  populateHeroDemoCountryCodes();
  const form = document.getElementById('heroDemoForm');
  const errorEl = document.getElementById('heroDemoError');
  const submitBtn = document.getElementById('heroDemoSubmitBtn');
  const termsLink = document.getElementById('heroDemoTermsLink');
  if (!form) return;

  if (termsLink && window.__KC_TERMS_URL__) {
    termsLink.href = window.__KC_TERMS_URL__;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const firstName = document.getElementById('heroDemoFirstName').value.trim();
    const lastName = document.getElementById('heroDemoLastName').value.trim();
    const email = document.getElementById('heroDemoEmail').value.trim();
    const dial = document.getElementById('heroDemoCountryCode').value;
    const localNumber = document.getElementById('heroDemoPhone').value.trim().replace(/[^\d]/g, '');
    const termsAccepted = document.getElementById('heroDemoTerms').checked;
    const whatsappOptIn = document.getElementById('heroDemoWhatsapp').checked;
    const detailsConfirmed = document.getElementById('heroDemoConfirm').checked;

    if (!firstName || !lastName || !email || !localNumber) {
      errorEl.textContent = 'Please fill in all fields.';
      return;
    }
    if (!termsAccepted) {
      errorEl.textContent = 'Please accept the Terms & Conditions to continue.';
      return;
    }
    if (!detailsConfirmed) {
      errorEl.textContent = 'Please confirm your details are correct to continue.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering…';

    try {
      const res = await fetch('/api/demo-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName, lastName, email,
          countryCode: dial, phoneNumber: localNumber,
          termsAccepted, detailsConfirmed, whatsappOptIn
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not register — please try again.');

      form.style.display = 'none';
      const card = form.closest('.event-hero-card');
      if (card) {
        const confirmEl = document.createElement('div');
        confirmEl.className = 'hero-form-confirm';
        confirmEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Thanks, ${escapeHtml(firstName)}! You're registered for the free demo session — check your email for confirmation and a calendar invite.`;
        card.appendChild(confirmEl);
      }
    } catch (err) {
      console.error('[hero-demo-form] registration failed:', err);
      errorEl.textContent = err.message || 'Something went wrong — please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register now';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('heroSettingsSaveBtn');
  if (btn) btn.addEventListener('click', saveHeroSettings);
  loadHeroSettings();
  initHeroDemoForm();
  initCourseDetailsSection();
});
