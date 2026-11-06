const nav = document.getElementById('nav');
const burger = document.getElementById('burger');
const overlay = document.getElementById('menuOverlay');


let ticking = false;

function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 20);
    ticking = false;
}

window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(onScroll);
        ticking = true;
    }
}, { passive: true });


function toggleMenu() {
    const isOpen = burger.classList.toggle('open');
    overlay.classList.toggle('open', isOpen);
    nav.classList.toggle('menu-open', isOpen);
    document.body.classList.toggle('no-scroll', isOpen);
    burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
}

burger.addEventListener('click', toggleMenu);

overlay.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        if (burger.classList.contains('open')) toggleMenu();
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger.classList.contains('open')) toggleMenu();
});


const revealItems = document.querySelectorAll('[data-reveal]');

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
    });
}, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

revealItems.forEach(el => revealObserver.observe(el));


const sections = document.querySelectorAll('[data-section]');
const indexEl = document.getElementById('scrollIndex');
const totalEl = document.getElementById('scrollTotal');

if (indexEl && totalEl) {
    totalEl.textContent = String(sections.length).padStart(2, '0');

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const i = [...sections].indexOf(entry.target) + 1;
            indexEl.textContent = String(i).padStart(2, '0');
        });
    }, { threshold: 0.5 });

    sections.forEach(s => sectionObserver.observe(s));
}


const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();


const BG_IMAGES = [
    'img/random/cooking1.avif',
    'img/random/cooking2.jpg',
    'img/random/cooking3.jpg',
    'img/random/cooking4.jpg',
    'img/random/cooking5.jpg',
    'img/random/cooking6.jpg',
    'img/random/cooking7.jpg',
    'img/random/cooking8.jpg',
    'img/random/cooking9.jpg',
    'img/random/cooking10.jpg',
    'img/random/cooking11.jpg',
    'img/random/cooking12.jpg',
    'img/random/cooking13.jpg',
    'img/random/cooking14.jpg',
    'img/random/cooking15.jpg',
    'img/random/cooking16.jpg',
    'img/random/cooking17.jpg',
];
const bgPick = BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)];
document.querySelectorAll('.next-event-visual').forEach(el => {
    el.style.setProperty('--bg', `url(${bgPick})`);
});


const CALENDAR_ID = 'e6840b77a0d5f21fcf0aa46da7e475693ceb687c1a4969955dfc15cfbecc441e@group.calendar.google.com';
const API_KEY = 'AIzaSyBuVtVPzqwY1xYsCH26R_vmO9GTIx4LIQY';
const TZ = 'America/Toronto';
const SEASON_LIMIT = 4;


function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

function stripHtml(s) {
    return (s || '').replace(/<[^>]+>/g, '').trim();
}

function isoOf(start) {
    return start.dateTime || start.date;
}


// All-day events arrive as "YYYY-MM-DD" with no time. new Date() reads that as
// UTC midnight, which slips to the previous day once shown in Toronto time.
// Build it from the parts as a local date so the calendar day is preserved.
function dateFromIso(iso) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(iso);
}

// Only apply the TZ shift to timed events. All-day dates are already local.
function fmtOpts(iso, opts) {
    const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    return isAllDay ? opts : { ...opts, timeZone: TZ };
}

function fmtDay(iso) {
    return dateFromIso(iso).toLocaleDateString('en-CA', fmtOpts(iso, { day: '2-digit' }));
}

function fmtMonthYear(iso) {
    return dateFromIso(iso).toLocaleDateString('en-US', fmtOpts(iso, { month: 'short', year: 'numeric' }));
}

function fmtMonthAbbr(iso) {
    return dateFromIso(iso).toLocaleDateString('en-US', fmtOpts(iso, { month: 'short' }));
}

function fmtWeekday(iso) {
    return dateFromIso(iso).toLocaleDateString('en-US', fmtOpts(iso, { weekday: 'long' }));
}

function fmtTimeFull(start) {
    if (!start.dateTime) return 'All day';
    return new Date(start.dateTime).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: TZ
    });
}


function italicizeTitle(title) {
    const words = (title || '').split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return escapeHtml('Untitled event');
    if (words.length === 1) return escapeHtml(words[0]);
    const tail = words.length >= 4 ? 2 : 1;
    const head = words.slice(0, words.length - tail).join(' ');
    const emPart = words.slice(-tail).join(' ');
    return escapeHtml(head) + ' <em>' + escapeHtml(emPart) + '</em>';
}


function observeReveals(root) {
    const items = root.querySelectorAll('[data-reveal]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
        items.forEach(el => el.classList.add('is-visible'));
        return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => io.observe(el));
}


function renderUpNext(ev) {
    const root = document.getElementById('next');
    if (!root) return;

    const iso = isoOf(ev.start);

    const dayEl = root.querySelector('.next-event-date-tag .big');
    const monthEl = root.querySelector('.next-event-date-tag .small');
    if (dayEl) dayEl.textContent = fmtDay(iso);
    if (monthEl) monthEl.textContent = fmtMonthYear(iso);

    const label = root.querySelector('.next-event-visual-label');
    if (label) label.style.display = 'none';

    const titleEl = root.querySelector('.next-event-text h2');
    if (titleEl) titleEl.innerHTML = italicizeTitle(ev.summary || 'Untitled event');

    const metaEl = root.querySelector('.next-event-text .meta');
    if (metaEl) {
        const parts = [fmtWeekday(iso), fmtTimeFull(ev.start)];
        if (ev.location) parts.push(ev.location);
        metaEl.innerHTML = parts.map(p => `<span>${escapeHtml(p)}</span>`).join('');
    }

    const descEl = root.querySelector('.next-event-text p');
    if (descEl) {
        const text = stripHtml(ev.description);
        if (text) {
            descEl.textContent = text;
            descEl.style.display = '';
        } else {
            descEl.style.display = 'none';
        }
    }

    const rsvpBtn = root.querySelector('.next-event-actions .btn-solid');
    if (rsvpBtn && ev.htmlLink) {
        rsvpBtn.href = 'https://linktr.ee/mcgillstudentsculinarysociety?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAcGRvZgJleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA85MzY2MTk3NDMzOTI0NTkAAafvepzkRH7K3JC6a2bYmeDzYWkkfMoC79EqoB3lBE_QBWGT85HytW9rJnojdQ_aem_llYxlj5lG2-xfqDGFuUjWw';
        rsvpBtn.target = '_blank';
        rsvpBtn.rel = 'noopener';
    }
}


// Fills the "Up Next" block inside the fullscreen menu overlay. This block
// exists on every page, so this keeps all pages in sync with the calendar.
function renderMenuFeature(ev) {
    const root = document.querySelector('.menu-feature');
    if (!root) return;

    const iso = isoOf(ev.start);

    const visual = root.querySelector('.menu-feature-visual');
    if (visual) visual.style.display = '';

    const big = root.querySelector('.menu-feature-date .big');
    const small = root.querySelector('.menu-feature-date .small');
    if (big) big.textContent = fmtDay(iso);
    if (small) small.textContent = fmtMonthYear(iso);

    const titleEl = root.querySelector('.menu-feature-title');
    if (titleEl) titleEl.innerHTML = italicizeTitle(ev.summary || 'Untitled event');

    const metaEl = root.querySelector('.menu-feature-meta');
    if (metaEl) {
        const parts = [fmtWeekday(iso), fmtTimeFull(ev.start)];
        if (ev.location) parts.push(ev.location);
        metaEl.textContent = parts.join(' · ');
    }

    const link = root.querySelector('.menu-feature-link');
    if (link && ev.htmlLink) {
        link.href = 'https://linktr.ee/mcgillstudentsculinarysociety?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAcGRvZgJleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA85MzY2MTk3NDMzOTI0NTkAAafvepzkRH7K3JC6a2bYmeDzYWkkfMoC79EqoB3lBE_QBWGT85HytW9rJnojdQ_aem_llYxlj5lG2-xfqDGFuUjWw';
        link.target = '_blank';
        link.rel = 'noopener';
    }
}

function renderMenuFeatureEmpty() {
    const root = document.querySelector('.menu-feature');
    if (!root) return;

    const visual = root.querySelector('.menu-feature-visual');
    if (visual) visual.style.display = 'none';

    const titleEl = root.querySelector('.menu-feature-title');
    if (titleEl) titleEl.innerHTML = 'Coming up <em>this term</em>...';

    const metaEl = root.querySelector('.menu-feature-meta');
    if (metaEl) metaEl.textContent = 'Between events';

    const link = root.querySelector('.menu-feature-link');
    if (link) {
        link.href = '/calendar.html';
        link.removeAttribute('target');
        link.removeAttribute('rel');
    }
}


function renderSeason(events) {
    const list = document.querySelector('#season .event-list');
    if (!list || !events.length) return;

    list.style.borderTop = '';
    list.innerHTML = events.map((ev, i) => {
        const iso = isoOf(ev.start);
        const day = fmtDay(iso);
        const monthAbbr = fmtMonthAbbr(iso);
        const delayAttr = i > 0 ? ` data-reveal-delay="${i}"` : '';
        const venue = ev.location ? escapeHtml(ev.location) : '';
        const name = escapeHtml(ev.summary || 'Untitled event');

        return `
            <li class="event-row" data-reveal${delayAttr}>
                <span class="event-date ui">
                    <strong>${escapeHtml(day)}</strong>
                    ${escapeHtml(monthAbbr)}
                </span>
                <span class="event-name">${name}</span>
                <span class="event-venue ui">${venue}</span>
                <span class="event-spots ui">Open</span>
                <span class="event-go" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M3 8 L13 8 M9 4 L13 8 L9 12"></path>
                    </svg>
                </span>
            </li>
        `;
    }).join('');

    list.querySelectorAll('.event-row').forEach((row, i) => {
        const link = events[i].htmlLink;
        if (!link) return;
        row.addEventListener('click', () => window.open(link, '_blank', 'noopener'));
    });

    observeReveals(list);
}


function renderUpNextEmpty() {
    const wrap = document.querySelector('#next .next-event');
    if (!wrap) return;
    wrap.style.gridTemplateColumns = '1fr';
    wrap.style.alignItems = 'start';
    wrap.innerHTML = `
        <div class="next-event-text">
            <h2>Nothing scheduled<br><em>just yet</em>.</h2>
            <div class="meta"><span>Between events</span></div>
            <p>We're between events right now. The full calendar has what's around the corner, and Instagram is the fastest way to hear about the next one.</p>
            <div class="next-event-actions">
                <a href="/calendar.html" class="btn-solid">
                    See the calendar
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M2 8 L14 8 M9 3 L14 8 L9 13"></path>
                    </svg>
                </a>
                <a href="https://www.instagram.com/mcgillculinarysociety/" target="_blank" rel="noopener" class="btn-link">Instagram</a>
            </div>
        </div>
    `;
}


function renderSeasonEmpty() {
    const list = document.querySelector('#season .event-list');
    if (!list) return;
    list.innerHTML = `
        <li style="padding: 60px 0; font-family: var(--display); font-style: italic; font-size: 22px; color: var(--ink-soft); text-align: center; list-style: none;">
            Nothing on the books just yet. Check back soon.
        </li>
    `;
}


async function loadHomeEvents() {
    if (!CALENDAR_ID || !API_KEY) {
        renderUpNextEmpty();
        renderSeasonEmpty();
        renderMenuFeatureEmpty();
        return;
    }

    try {
        const params = new URLSearchParams({
            key: API_KEY,
            singleEvents: 'true',
            orderBy: 'startTime',
            timeMin: new Date().toISOString(),
            maxResults: '20'
        });
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Calendar API ' + res.status);
        const data = await res.json();
        const events = data.items || [];
        console.log('Home events: fetched ' + events.length + ' upcoming events');

        if (events.length === 0) {
            renderUpNextEmpty();
            renderSeasonEmpty();
            renderMenuFeatureEmpty();
            return;
        }

        renderUpNext(events[0]);
        renderSeason(events.slice(0, SEASON_LIMIT));
        renderMenuFeature(events[0]);
    } catch (err) {
        console.warn('Home events failed:', err);
        renderUpNextEmpty();
        renderSeasonEmpty();
        renderMenuFeatureEmpty();
    }
}


loadHomeEvents();