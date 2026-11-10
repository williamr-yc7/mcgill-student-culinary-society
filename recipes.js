/* Recipes page. Reads /recipes/recipes.json, which `npm run build` generates from the Word files in /recipes.
   Wrapped in an IIFE so it can load after home.js without name clashes. */
(function () {
    'use strict';

    const DATA_URL = '/recipes/recipes.json';

    // Chips appear in this order; any other category goes after them alphabetically.
    const CATEGORY_ORDER = ['Mains', 'Soups', 'Sides', 'Baking', 'Sweets', 'Drinks', 'Other'];

    // Line illustrations per category, drawn in a 200 × 200 box.
    const ART = {
        Mains:
            '<circle cx="100" cy="104" r="46"/><circle cx="100" cy="104" r="30"/>' +
            '<path d="M38 44 V164"/><path d="M31 44 V70 Q31 82 38 82 Q45 82 45 70 V44"/>' +
            '<path d="M162 164 V44 Q176 66 172 100 H162"/>',
        Soups:
            '<path d="M30 100 H170"/><path d="M42 100 Q44 148 100 156 Q156 148 158 100"/><path d="M84 156 H116"/>' +
            '<path d="M80 84 Q72 70 80 58 Q88 46 80 34"/><path d="M100 84 Q92 68 100 54 Q108 40 100 26"/><path d="M120 84 Q112 70 120 58 Q128 46 120 34"/>',
        Sides:
            '<path d="M58 162 C38 100 70 40 152 34 C162 112 120 162 58 162 Z"/><path d="M58 162 C92 122 122 80 152 34"/>' +
            '<path d="M80 138 Q74 120 78 104"/><path d="M98 116 Q94 98 100 84"/><path d="M114 94 Q114 78 122 66"/>' +
            '<path d="M86 132 Q104 132 118 124"/><path d="M106 106 Q122 106 136 96"/>',
        Baking:
            '<path d="M100 20 Q102 70 100 130 Q98 160 95 180"/>' +
            '<path d="M100 50 Q80 40 60 50 Q80 55 100 60"/><path d="M100 50 Q120 40 140 50 Q120 55 100 60"/>' +
            '<path d="M100 75 Q78 65 56 78 Q80 82 100 85"/><path d="M100 75 Q122 65 144 78 Q120 82 100 85"/>' +
            '<path d="M100 102 Q76 92 52 108 Q80 110 100 113"/><path d="M100 102 Q124 92 148 108 Q120 110 100 113"/>' +
            '<path d="M100 130 Q80 122 64 138 Q84 138 100 140"/><path d="M100 130 Q120 122 136 138 Q116 138 100 140"/>',
        Sweets:
            '<path d="M94 22 H106 V80 H94 Z"/><path d="M100 80 Q56 120 100 176 Q144 120 100 80"/>' +
            '<path d="M100 80 Q76 124 100 176 Q124 124 100 80"/><path d="M100 80 V176"/>',
        Drinks:
            '<path d="M66 64 H134"/><path d="M70 64 L80 158 Q100 166 120 158 L130 64"/><path d="M74 98 H126"/><path d="M76 116 H124"/>' +
            '<path d="M90 50 Q84 40 90 30 Q96 20 90 12"/><path d="M110 50 Q104 40 110 30 Q116 20 110 12"/>',
        Other:
            '<path d="M100 28 Q120 28 120 60 Q120 86 100 90 Q80 86 80 60 Q80 28 100 28 Z"/><path d="M100 90 V174"/>'
    };

    // Bolds the amount at the start of an ingredient line ("1 ½ tbsp", "1-2 cups", "125 grams").
    const NUM = '(?:\\d+(?:[.,]\\d+)?(?:\\s*[½¼¾⅓⅔⅛]|\\s+\\d+\\/\\d+|\\/\\d+)?|[½¼¾⅓⅔⅛])';
    const UNIT = '(?:lbs?|pounds?|oz|ounces?|cups?|tbsps?|tablespoons?|tsps?|teaspoons?|grams?|g|kg|ml|l|litres?|liters?|cloves?|sprigs?|pinch(?:es)?|cans?|bunch(?:es)?|stalks?|slices?|sticks?|handfuls?)\\b\\.?';
    const QTY_RE = new RegExp('^(' + NUM + '(?:\\s*(?:-|–|to)\\s*' + NUM + ')?(?:\\s*' + UNIT + ')?)(?=\\s)', 'i');

    const $ = (sel, root = document) => root.querySelector(sel);
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const els = {
        grid: $('#recipeGrid'),
        chips: $('#recipeChips'),
        search: $('#recipeSearch'),
        count: $('#recipeCount'),
        empty: $('#recipeEmpty'),
        clear: $('#recipeClear'),
        drawer: $('#recipeDrawer'),
        scrim: $('#drawerScrim'),
        close: $('#drawerClose'),
        content: $('#drawerContent'),
        crumb: $('#drawerCrumb')
    };
    if (!els.grid || !els.drawer) return;

    const baseTitle = document.title;
    const state = { cat: 'All', q: '' };
    let RECIPES = [];
    let BY_SLUG = {};
    let checked = new Set();
    let lastFocus = null;
    let openedByNav = false;


    /* Data */

    function prepare(list) {
        RECIPES = list.map((r) => {
            const ingredients = r.ingredients || [];
            const method = r.method || [];
            const out = Object.assign({}, r, {
                ingredients: ingredients,
                method: method,
                notes: r.notes || [],
                category: r.category || 'Other',
                ingredientCount: ingredients.reduce((n, g) => n + g.items.length, 0),
                stepCount: method.reduce((n, g) => n + g.steps.length, 0)
            });
            out._hay = norm([out.title, out.category, out.by || '']
                .concat(ingredients.map((g) => (g.heading || '') + ' ' + g.items.join(' ')))
                .join(' '));
            return out;
        });
        BY_SLUG = {};
        RECIPES.forEach((r) => { BY_SLUG[r.slug] = r; });
    }

    function categories() {
        const found = Array.from(new Set(RECIPES.map((r) => r.category)));
        return found.sort((a, b) => {
            const ia = CATEGORY_ORDER.indexOf(a);
            const ib = CATEGORY_ORDER.indexOf(b);
            if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            return a.localeCompare(b);
        });
    }


    /* Formatting */

    function fmtTime(min) {
        if (min < 60) return min + ' min';
        const h = Math.floor(min / 60);
        const m = min % 60;
        return m ? h + ' h ' + m : h + ' h';
    }

    function ingredientHTML(text) {
        const m = text.match(QTY_RE);
        if (!m) return esc(text);
        return '<b class="qty">' + esc(m[1]) + '</b>' + esc(text.slice(m[1].length));
    }


    /* Grid */

    function visual(r, extra) {
        let big, small;
        if (r.time) {
            big = r.time < 60 ? String(r.time) : fmtTime(r.time).replace(' ', '');
            small = r.time < 60 ? 'min' : 'total';
        } else {
            big = String(r.stepCount);
            small = r.stepCount === 1 ? 'step' : 'steps';
        }
        const label = r.serves ? 'Serves ' + r.serves : plural(r.ingredientCount, 'ingredient');
        const art = r.image
            ? '<img src="' + esc(r.image) + '" alt="" loading="lazy">'
            : '<svg class="recipe-art" viewBox="0 0 200 200" aria-hidden="true">' + (ART[r.category] || ART.Other) + '</svg>';

        return '<div class="recipe-visual ' + (extra || '') + '" data-cat="' + esc(r.category.toLowerCase()) + '">' +
            art +
            '<div class="recipe-time"><span class="big">' + esc(big) + '</span><span class="small">' + esc(small) + '</span></div>' +
            '<div class="recipe-visual-label"><span>' + esc(r.category) + '</span><span>' + esc(label) + '</span></div>' +
            '</div>';
    }

    function card(r) {
        return '<li class="recipe-card"><a class="recipe-link" href="#' + esc(r.slug) + '">' +
            visual(r) +
            '<h3>' + esc(r.title) + '</h3>' +
            (r.by ? '<p class="recipe-by">Shared by ' + esc(r.by) + '</p>' : '') +
            '</a></li>';
    }

    function renderChips() {
        const cats = categories();
        const counts = { All: RECIPES.length };
        cats.forEach((c) => { counts[c] = RECIPES.filter((r) => r.category === c).length; });

        els.chips.innerHTML = (cats.length > 1 ? ['All'].concat(cats) : [])
            .map((c) => '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (c === state.cat) + '">' +
                esc(c) + '<span class="n">' + counts[c] + '</span></button>')
            .join('');
    }

    function countText(n) {
        let t = plural(n, 'recipe');
        if (state.cat !== 'All') t += ' in ' + state.cat;
        if (state.q.trim()) t += ' matching “' + state.q.trim() + '”';
        return t;
    }

    function renderGrid(animate) {
        const terms = norm(state.q).split(/\s+/).filter(Boolean);
        const list = RECIPES.filter((r) =>
            (state.cat === 'All' || r.category === state.cat) && terms.every((t) => r._hay.includes(t)));

        els.grid.innerHTML = list.map(card).join('');
        els.empty.hidden = list.length > 0;
        els.count.textContent = countText(list.length);

        if (animate && !reduceMotion && els.grid.animate) {
            els.grid.animate(
                [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
                { duration: 380, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }
            );
        }
    }

    els.chips.addEventListener('click', (e) => {
        const b = e.target.closest('.chip');
        if (!b || b.dataset.cat === state.cat) return;
        state.cat = b.dataset.cat;
        els.chips.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        renderGrid(true);
    });

    els.search.addEventListener('input', () => {
        state.q = els.search.value;
        renderGrid(false);
    });

    els.clear.addEventListener('click', () => {
        state.cat = 'All';
        state.q = '';
        els.search.value = '';
        renderChips();
        renderGrid(true);
    });


    /* Drawer */

    function drawerHTML(r) {
        const facts = [];
        if (r.time) facts.push(['Time', fmtTime(r.time)]);
        if (r.serves) facts.push(['Serves', String(r.serves)]);
        facts.push(['Ingredients', String(r.ingredientCount)]);
        facts.push(['Steps', String(r.stepCount)]);

        let idx = 0;
        const ingredients = r.ingredients.map((g) =>
            (g.heading ? '<li class="ing-head">' + esc(g.heading) + '</li>' : '') +
            g.items.map((item) => {
                const i = idx++;
                return '<li><label><input type="checkbox" data-idx="' + i + '"><span>' + ingredientHTML(item) + '</span></label></li>';
            }).join('')
        ).join('');

        const method = r.method.map((g) =>
            (g.heading ? '<h4 class="method-sub">' + esc(g.heading) + '</h4>' : '') +
            '<ol class="method">' + g.steps.map((s) => '<li><p>' + esc(s) + '</p></li>').join('') + '</ol>'
        ).join('');

        return visual(r, 'drawer-visual') +
            '<h2 id="drawerTitle">' + esc(r.title) + '</h2>' +
            (r.by ? '<p class="drawer-by">Shared by ' + esc(r.by) + '</p>' : '') +
            (r.story ? '<p class="drawer-story">' + esc(r.story) + '</p>' : '') +
            '<dl class="facts">' +
                facts.map((f) => '<div class="fact"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>').join('') +
            '</dl>' +
            '<div class="drawer-sec"><h3>Ingredients</h3>' +
                (r.ingredientsNote ? '<p class="drawer-note">' + esc(r.ingredientsNote) + '</p>' : '') +
                '<ul class="ingredients">' + ingredients + '</ul></div>' +
            '<div class="drawer-sec"><h3>Method</h3>' + method + '</div>' +
            (r.notes.length ? '<div class="drawer-sec"><h3>Notes</h3>' +
                r.notes.map((n) => '<p class="drawer-notes-p">' + esc(n) + '</p>').join('') + '</div>' : '') +
            '<div class="drawer-actions">' +
                '<button type="button" class="btn-solid" id="printBtn">Print recipe</button>' +
                '<button type="button" class="btn-link" id="copyBtn">Copy link</button>' +
                (r.file ? '<a class="btn-link" href="' + esc(r.file) + '" download>Download Word file</a>' : '') +
            '</div>';
    }

    function openRecipe(r) {
        if (!document.body.classList.contains('drawer-open')) lastFocus = document.activeElement;
        checked = new Set();

        els.crumb.textContent = r.category;
        els.content.innerHTML = drawerHTML(r);
        document.title = r.title + ' · Recipes · MSCS';

        document.body.classList.add('drawer-open');
        els.drawer.setAttribute('aria-hidden', 'false');
        els.drawer.inert = false;
        els.drawer.scrollTop = 0;
        setTimeout(() => els.close.focus({ preventScroll: true }), 60);
    }

    function closeUI() {
        document.body.classList.remove('drawer-open');
        els.drawer.setAttribute('aria-hidden', 'true');
        els.drawer.inert = true;
        document.title = baseTitle;
        if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }

    function requestClose() {
        if (openedByNav) {
            openedByNav = false;
            history.back();
        } else {
            history.replaceState(null, '', location.pathname + location.search);
            closeUI();
        }
    }

    function route(fromNav) {
        const slug = decodeURIComponent(location.hash.slice(1));
        const r = BY_SLUG[slug];
        if (r) {
            if (fromNav) openedByNav = true;
            openRecipe(r);
        } else if (document.body.classList.contains('drawer-open')) {
            openedByNav = false;
            closeUI();
        }
    }

    els.content.addEventListener('click', (e) => {
        if (e.target.closest('#printBtn')) {
            window.print();
            return;
        }
        const copyBtn = e.target.closest('#copyBtn');
        if (copyBtn && navigator.clipboard) {
            navigator.clipboard.writeText(location.href).then(() => {
                copyBtn.textContent = 'Link copied';
                setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 2000);
            }, () => {});
        }
    });

    els.content.addEventListener('change', (e) => {
        if (!e.target.matches('.ingredients input')) return;
        const i = Number(e.target.dataset.idx);
        if (e.target.checked) checked.add(i); else checked.delete(i);
    });

    els.close.addEventListener('click', requestClose);
    els.scrim.addEventListener('click', requestClose);

    document.addEventListener('keydown', (e) => {
        if (!document.body.classList.contains('drawer-open')) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            requestClose();
            return;
        }
        if (e.key !== 'Tab') return;

        const focusable = Array.from(els.drawer.querySelectorAll('a[href], button:not([disabled]), input'))
            .filter((el) => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && (document.activeElement === first || !els.drawer.contains(document.activeElement))) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !els.drawer.contains(document.activeElement))) {
            e.preventDefault();
            first.focus();
        }
    });

    window.addEventListener('hashchange', () => route(true));


    /* Init */

    fetch(DATA_URL, { cache: 'no-cache' })
        .then((res) => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then((data) => {
            prepare(data.recipes || []);
            renderChips();
            renderGrid(false);
            if (!RECIPES.length) {
                els.empty.hidden = true;
                els.count.textContent = 'No recipes yet. The first ones go up after the next recipe swap.';
            }
            route(false);
        })
        .catch((err) => {
            console.error('Recipes failed to load:', err);
            els.count.textContent = 'Recipes couldn’t load. Refresh the page to try again.';
        });
})();