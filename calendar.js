(function () {
'use strict';

const CALENDAR_ID = 'e6840b77a0d5f21fcf0aa46da7e475693ceb687c1a4969955dfc15cfbecc441e@group.calendar.google.com';
const API_KEY = 'AIzaSyBuVtVPzqwY1xYsCH26R_vmO9GTIx4LIQY';
const TZ = 'America/Toronto';
const FETCH_PAST_MONTHS = 2;
const FETCH_MAX_RESULTS = 250;
const CELL_VISIBLE_CHIPS = 3;


const $ = (id) => document.getElementById(id);

const calControls = $('calControls');
const calWeekheader = $('calWeekheader');
const calGrid = $('calGrid');
const calState = $('calState');
const monthLabel = $('calMonthLabel');
const prevBtn = $('calPrev');
const nextBtn = $('calNext');
const todayBtn = $('calToday');
const subscribeBtn = $('subscribeBtn');

const modal = $('calModal');
const modalDayView = $('modalDayView');
const modalEventView = $('modalEventView');
const modalDayDate = $('modalDayDate');
const modalDayList = $('modalDayList');
const modalBackBtn = $('modalBackBtn');
const modalEyebrow = $('modalEyebrow');
const modalTitle = $('modalTitle');
const modalMeta = $('modalMeta');
const modalDesc = $('modalDesc');
const modalActions = $('modalActions');


let currentMonth = startOfMonth(new Date());
let allEvents = [];
const eventsByDate = new Map();
let lastDayKeyShown = null;


function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
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

function dateKeyMTL(d) {
    return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

function dateKeyFromIso(iso) {
    // For an all-day event the raw "YYYY-MM-DD" string is already the key format,
    // so return it untouched and skip the Date roundtrip that caused the day slip.
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

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

function fmtTimeShort(start) {
    if (!start.dateTime) return '';
    return new Date(start.dateTime).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: TZ
    });
}

function fmtTimeFull(start) {
    if (!start.dateTime) return 'All day';
    return new Date(start.dateTime).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: TZ
    });
}

function fmtModalDayDate(dateKey) {
    const [y, m, day] = dateKey.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    return d.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
}

function fmtEventEyebrow(ev) {
    const iso = isoOf(ev.start);
    return dateFromIso(iso).toLocaleDateString('en-US',
        fmtOpts(iso, { weekday: 'long', month: 'long', day: 'numeric' }));
}


function showState(html, cls) {
    calState.innerHTML = `<div class="cal-state cal-${cls}">${html}</div>`;
}

function clearState() {
    calState.innerHTML = '';
}

function showSetup() {
    hideCalendarUI();
    showState(
        `Setup needed. Paste your Calendar ID and API key into <code>calendar.js</code>.`,
        'setup'
    );
}

function showLoading() {
    hideCalendarUI();
    showState('Loading the calendar', 'loading');
}

function showError() {
    hideCalendarUI();
    showState(
        `We couldn't load the calendar right now. Try refreshing, or reach the events team on the <a href="/contact.html">contact page</a>.`,
        'error'
    );
}

function showCalendarUI() {
    clearState();
    calControls.hidden = false;
    calWeekheader.hidden = false;
    calGrid.hidden = false;
}

function hideCalendarUI() {
    calControls.hidden = true;
    calWeekheader.hidden = true;
    calGrid.hidden = true;
}


function indexEvents(events) {
    eventsByDate.clear();
    for (const ev of events) {
        const key = dateKeyFromIso(isoOf(ev.start));
        if (!eventsByDate.has(key)) eventsByDate.set(key, []);
        eventsByDate.get(key).push(ev);
    }
    for (const arr of eventsByDate.values()) {
        arr.sort((a, b) => isoOf(a.start).localeCompare(isoOf(b.start)));
    }
}

function getEventsForKey(key) {
    return eventsByDate.get(key) || [];
}


function renderMonth() {
    monthLabel.textContent = currentMonth.toLocaleDateString('en-US', {
        month: 'long', year: 'numeric'
    });

    const year = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const firstOfMonth = new Date(year, m, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    const today = new Date();
    const cells = [];

    for (let i = 0; i < totalCells; i++) {
        const d = new Date(year, m, 1 - startWeekday + i);
        cells.push(buildCellHtml(d, m, today));
    }

    calGrid.innerHTML = cells.join('');
    wireCellInteractions();
}

function buildCellHtml(d, currentMonthIdx, today) {
    const key = dateKeyMTL(d);
    const events = getEventsForKey(key);
    const visible = events.slice(0, CELL_VISIBLE_CHIPS);
    const overflow = events.length - visible.length;
    const isOut = d.getMonth() !== currentMonthIdx;
    const isToday = isSameDay(d, today);

    const classes = ['cal-cell'];
    if (isOut) classes.push('is-out');
    if (isToday) classes.push('is-today');

    const chips = visible.map(buildChipHtml).join('');
    const more = overflow > 0
        ? `<button class="cal-more" data-day-key="${escapeHtml(key)}">+${overflow} more</button>`
        : '';

    return `
        <div class="${classes.join(' ')}" data-date="${escapeHtml(key)}">
            <span class="cal-cell-day">${d.getDate()}</span>
            <div class="cal-cell-events">${chips}${more}</div>
        </div>
    `;
}

function buildChipHtml(ev) {
    const time = fmtTimeShort(ev.start);
    return `
        <button class="cal-chip" data-event-id="${escapeHtml(ev.id)}">
            ${time ? `<span class="cal-chip-time">${escapeHtml(time)}</span>` : ''}
            <span class="cal-chip-title">${escapeHtml(ev.summary || 'Untitled')}</span>
        </button>
    `;
}

function wireCellInteractions() {
    calGrid.querySelectorAll('.cal-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const ev = allEvents.find(e => e.id === btn.dataset.eventId);
            if (ev) openEventModal(ev, false);
        });
    });

    calGrid.querySelectorAll('.cal-more').forEach(btn => {
        btn.addEventListener('click', () => {
            openDayModal(btn.dataset.dayKey);
        });
    });
}


function openDayModal(dayKey) {
    const events = getEventsForKey(dayKey);
    if (!events.length) return;

    lastDayKeyShown = dayKey;

    modalDayDate.textContent = fmtModalDayDate(dayKey);
    modalDayList.innerHTML = events.map(ev => {
        const time = ev.start.dateTime ? fmtTimeFull(ev.start) : 'All day';
        return `
            <li>
                <button class="cal-modal-list-item" data-event-id="${escapeHtml(ev.id)}">
                    <span class="time">${escapeHtml(time)}</span>
                    <span class="title">${escapeHtml(ev.summary || 'Untitled')}</span>
                    <svg class="arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M3 8 L13 8 M9 4 L13 8 L9 12"></path>
                    </svg>
                </button>
            </li>
        `;
    }).join('');

    modalDayList.querySelectorAll('.cal-modal-list-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const ev = allEvents.find(e => e.id === btn.dataset.eventId);
            if (ev) openEventModal(ev, true);
        });
    });

    showModalView('day');
    showModal();
}

function openEventModal(ev, fromDayList) {
    modalEyebrow.textContent = fmtEventEyebrow(ev);
    modalTitle.textContent = ev.summary || 'Untitled event';

    const metaParts = [];
    metaParts.push(fmtTimeFull(ev.start));
    if (ev.location) metaParts.push(ev.location);
    modalMeta.innerHTML = metaParts.map(p => `<span>${escapeHtml(p)}</span>`).join('');

    const desc = stripHtml(ev.description);
    if (desc) {
        modalDesc.textContent = desc;
        modalDesc.hidden = false;
    } else {
        modalDesc.textContent = '';
        modalDesc.hidden = true;
    }

    const viewLink = ev.htmlLink || '#';
    const addLink = buildAddLink(ev);

    modalActions.innerHTML = `
        <a class="btn-solid" href="${escapeHtml(viewLink)}" target="_blank" rel="noopener">
            View on Google Calendar
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 8 L14 8 M9 3 L14 8 L9 13"></path>
            </svg>
        </a>
        <a class="btn-link" href="${escapeHtml(addLink)}" target="_blank" rel="noopener">
            Add to my calendar
        </a>
    `;

    modalBackBtn.hidden = !fromDayList;
    showModalView('event');
    showModal();
}

function showModalView(which) {
    modalDayView.hidden = which !== 'day';
    modalEventView.hidden = which !== 'event';
}

function showModal() {
    modal.hidden = false;
    document.body.classList.add('no-scroll');
    const card = modal.querySelector('.cal-modal-card');
    if (card) card.scrollTop = 0;
}

function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    lastDayKeyShown = null;
}

function buildAddLink(ev) {
    const start = isoOf(ev.start);
    const end = isoOf(ev.end) || start;
    const fmt = (iso) => iso.replace(/[-:]/g, '').split('.')[0];
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: ev.summary || '',
        dates: `${fmt(start)}/${fmt(end)}`,
        location: ev.location || '',
        details: ev.description || ''
    });
    return `https://calendar.google.com/calendar/render?${params}`;
}


function goPrev() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    renderMonth();
}

function goNext() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    renderMonth();
}

function goToday() {
    currentMonth = startOfMonth(new Date());
    renderMonth();
}


prevBtn.addEventListener('click', goPrev);
nextBtn.addEventListener('click', goNext);
todayBtn.addEventListener('click', goToday);

modal.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', closeModal);
});

modalBackBtn.addEventListener('click', () => {
    if (lastDayKeyShown) openDayModal(lastDayKeyShown);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
});


function wireSubscribeButton() {
    if (!subscribeBtn) return;
    if (!CALENDAR_ID) { subscribeBtn.hidden = true; return; }
    const enc = encodeURIComponent(CALENDAR_ID);
    subscribeBtn.href = `webcal://calendar.google.com/calendar/ical/${enc}/public/basic.ics`;
    subscribeBtn.hidden = false;
}


async function loadCalendar() {
    wireSubscribeButton();

    if (!CALENDAR_ID || !API_KEY) {
        showSetup();
        return;
    }

    showLoading();

    try {
        const timeMin = new Date();
        timeMin.setMonth(timeMin.getMonth() - FETCH_PAST_MONTHS);
        timeMin.setDate(1);
        timeMin.setHours(0, 0, 0, 0);

        const params = new URLSearchParams({
            key: API_KEY,
            singleEvents: 'true',
            orderBy: 'startTime',
            timeMin: timeMin.toISOString(),
            maxResults: String(FETCH_MAX_RESULTS)
        });

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Calendar API ' + res.status);
        const data = await res.json();

        allEvents = data.items || [];
        indexEvents(allEvents);
        showCalendarUI();
        renderMonth();
    } catch (err) {
        showError();
    }
}

loadCalendar();

})();