#!/usr/bin/env node
/*
 * Builds recipes/recipes.json from every .docx in recipes/.
 * Run with: npm run build
 *
 * Each Word file needs:
 *   - the dish name in the Title style (otherwise the file name is used)
 *   - an "Ingredients" heading (a Word heading, or a bold line) followed by the ingredients
 *   - numbered steps, optionally under headings such as "Method", "Sauce", "Plating"
 *
 * Optional extras go in recipes/meta.json, keyed by file name:
 *   { "Spaghetti_al_Limone.docx": { "category": "Mains", "by": "Name, U2", "story": "...",
 *     "time": 25, "serves": 2, "image": "/img/recipes/spaghetti.jpg", "hidden": false } }
 * Without a category, one is guessed from the title.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'recipes');
const OUT = path.join(DIR, 'recipes.json');
const META = path.join(DIR, 'meta.json');
const URL_BASE = '/recipes/';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const parseXml = (xml) => new DOMParser({ errorHandler: { warning() {}, error() {} } }).parseFromString(xml, 'text/xml');
const elems = (el) => Array.from(el ? el.childNodes : []).filter((n) => n.nodeType === 1);
const kids = (el, name) => elems(el).filter((n) => n.localName === name);
const kid = (el, name) => kids(el, name)[0] || null;
const attr = (el, name) => (el ? el.getAttributeNS(W, name) || el.getAttribute('w:' + name) || null : null);
const nfc = (s) => String(s).normalize('NFC');
const fold = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const clean = (s) => s.replace(/\s+/g, ' ').replace(/\s+([,.;:)])/g, '$1').trim();

function closest(node, localName) {
    for (let n = node.parentNode; n; n = n.parentNode) if (n.localName === localName) return n;
    return null;
}


/* Word structure helpers */

function loadStyles(xml) {
    const styles = {};
    if (!xml) return styles;
    for (const s of Array.from(parseXml(xml).getElementsByTagNameNS(W, 'style'))) {
        const pPr = kid(s, 'pPr');
        const numPr = pPr && kid(pPr, 'numPr');
        styles[attr(s, 'styleId')] = {
            name: (attr(kid(s, 'name'), 'val') || '').toLowerCase(),
            basedOn: attr(kid(s, 'basedOn'), 'val'),
            numId: numPr ? attr(kid(numPr, 'numId'), 'val') : null,
            ilvl: numPr ? attr(kid(numPr, 'ilvl'), 'val') : null
        };
    }
    return styles;
}

function styleInfo(styles, id) {
    const out = { name: (id || '').toLowerCase(), numId: null, ilvl: null };
    if (styles[id] && styles[id].name) out.name = styles[id].name;
    for (let s = id, depth = 0; s && styles[s] && depth < 6; s = styles[s].basedOn, depth++) {
        if (!out.numId && styles[s].numId) {
            out.numId = styles[s].numId;
            out.ilvl = styles[s].ilvl;
        }
    }
    return out;
}

function loadNumbering(xml) {
    const abs = {};
    const nums = {};
    if (xml) {
        const doc = parseXml(xml);
        for (const a of Array.from(doc.getElementsByTagNameNS(W, 'abstractNum'))) {
            const levels = {};
            for (const l of kids(a, 'lvl')) levels[attr(l, 'ilvl')] = attr(kid(l, 'numFmt'), 'val');
            abs[attr(a, 'abstractNumId')] = levels;
        }
        for (const n of Array.from(doc.getElementsByTagNameNS(W, 'num'))) {
            const over = {};
            for (const o of kids(n, 'lvlOverride')) {
                const lvl = kid(o, 'lvl');
                if (lvl) over[attr(o, 'ilvl')] = attr(kid(lvl, 'numFmt'), 'val');
            }
            nums[attr(n, 'numId')] = { absId: attr(kid(n, 'abstractNumId'), 'val'), over };
        }
    }
    return (numId, ilvl) => {
        const n = nums[numId];
        if (!n) return null;
        const lv = ilvl || '0';
        const levels = abs[n.absId] || {};
        return n.over[lv] || levels[lv] || levels['0'] || null;
    };
}

function runText(r) {
    let s = '';
    for (const c of elems(r)) {
        if (c.localName === 't') s += c.textContent;
        else if (c.localName === 'tab' || c.localName === 'br' || c.localName === 'cr') s += ' ';
        else if (c.localName === 'noBreakHyphen') s += '-';
    }
    const rPr = kid(r, 'rPr');
    const va = rPr && kid(rPr, 'vertAlign');
    // A superscript "o" after an oven temperature is a degree sign.
    if (va && attr(va, 'val') === 'superscript' && /^\s*[o0°]\s*$/.test(s)) s = '°';
    return s;
}

function isBold(r) {
    const rPr = kid(r, 'rPr');
    const b = rPr && kid(rPr, 'b');
    if (!b) return false;
    const v = attr(b, 'val');
    return !v || !['0', 'false', 'off'].includes(v);
}

function readParagraphs(doc, styles, numFmt) {
    const body = doc.getElementsByTagNameNS(W, 'body')[0];
    if (!body) return [];
    const out = [];

    for (const p of Array.from(body.getElementsByTagNameNS(W, 'p'))) {
        if (closest(p, 'Fallback')) continue;

        const runs = Array.from(p.getElementsByTagNameNS(W, 'r')).filter((r) => closest(r, 'p') === p && !closest(r, 'del'));
        const text = clean(runs.map(runText).join(''));
        if (!text) continue;

        const pPr = kid(p, 'pPr');
        const styleId = attr(pPr && kid(pPr, 'pStyle'), 'val');
        const st = styleInfo(styles, styleId);
        const numPr = pPr && kid(pPr, 'numPr');
        const numId = (numPr && attr(kid(numPr, 'numId'), 'val')) || st.numId;
        const ilvl = (numPr && attr(kid(numPr, 'ilvl'), 'val')) || st.ilvl || '0';

        let list = null;
        if (numId && numId !== '0') {
            const fmt = numFmt(numId, ilvl);
            list = !fmt || fmt === 'bullet' || fmt === 'none' ? 'bullet' : 'ordered';
        } else if (/list number/.test(st.name)) list = 'ordered';
        else if (/list bullet/.test(st.name)) list = 'bullet';

        const textRuns = runs.filter((r) => runText(r).trim());
        out.push({
            text,
            title: st.name === 'title',
            heading: /^heading\s*\d/.test(st.name),
            bold: textRuns.length > 0 && textRuns.every(isBold),
            list,
            level: Number(ilvl) || 0
        });
    }
    return out;
}


/* Turning paragraphs into a recipe */

const RE_INGREDIENTS = /\bingredients?\b/i;
const RE_METHOD = /\b(method|instructions?|directions?|steps|preparation|procedure)\b/i;
const RE_NOTES = /^(notes?|tips?|variations?|storage)$/i;

function headingLabel(text, re) {
    const label = clean(text.replace(/[:.\s]+$/, '').replace(/\(.*?\)/g, '').replace(re, ''));
    return label || null;
}

function toRecipe(paras, fallbackTitle) {
    const r = { title: null, ingredientsNote: null, servesHint: null, ingredients: [], method: [], notes: [] };
    let mode = null;          // 'ingredients' | 'method' | 'notes' | 'pending'
    let pending = null;       // a sub-heading whose kind depends on what follows it
    let group = null;

    const start = (kind, heading) => {
        mode = kind;
        pending = null;
        if (kind === 'notes') { group = null; return; }
        group = kind === 'ingredients' ? { heading, items: [] } : { heading, steps: [] };
        (kind === 'ingredients' ? r.ingredients : r.method).push(group);
    };

    for (const p of paras) {
        if (p.title && !r.title) { r.title = p.text; continue; }

        // Typed bullets and numbers ("- 2 eggs", "1. Mix") count as lists too.
        let text = p.text;
        let list = p.list;
        if (!list && /^[•·\-–*]\s+/.test(text)) { list = 'bullet'; text = text.replace(/^[•·\-–*]\s+/, ''); }
        else if (!list && /^\d{1,2}[.)]\s+/.test(text)) { list = 'ordered'; text = text.replace(/^\d{1,2}[.)]\s+/, ''); }

        const looksLikeHeading = !list && (p.heading || p.title ||
            (text.length <= 60 && (p.bold || /:$/.test(text)) && !/[.!?]$/.test(text.replace(/:$/, ''))));

        if (looksLikeHeading) {
            if (RE_INGREDIENTS.test(text)) {
                const note = (text.match(/\(([^)]+)\)/) || [])[1];
                if (note) {
                    const serves = note.match(/(?:serves|for)\s*(\d+)/i);
                    if (serves) r.servesHint = Number(serves[1]);
                    else if (/per (serving|person|portion)/i.test(note)) r.servesHint = 1;
                    else r.ingredientsNote = clean(note);
                }
                start('ingredients', headingLabel(text, RE_INGREDIENTS));
            } else if (RE_METHOD.test(text)) {
                start('method', headingLabel(text, RE_METHOD));
            } else if (RE_NOTES.test(text.replace(/[:.\s]+$/, ''))) {
                start('notes', null);
            } else {
                mode = 'pending';
                pending = headingLabel(text, /$^/);
                group = null;
            }
            continue;
        }

        let kind;
        if (mode === 'notes') kind = 'notes';
        else if (list === 'ordered') kind = 'method';
        else if (mode === 'ingredients' || mode === 'method') kind = mode;
        else kind = r.method.length ? 'method' : 'ingredients';

        if (kind === 'notes') { r.notes.push(text); continue; }

        // A sub-bullet under a step belongs to that step.
        if (kind === 'method' && mode === 'method' && p.level > 0 && group && group.steps.length) {
            group.steps[group.steps.length - 1] += ' ' + text;
            continue;
        }

        if (mode !== kind || !group) start(kind, mode === 'pending' ? pending : null);
        (kind === 'ingredients' ? group.items : group.steps).push(text);
    }

    r.title = r.title || fallbackTitle;
    return r;
}


/* Metadata */

const CATEGORY_GUESSES = [
    ['Soups', /\b(soup|stew|chowder|bisque|broth|ramen|pho|potage)\b/],
    ['Drinks', /\b(tea|coffee|latte|smoothie|lemonade|cocktail|mocktail|chai|juice|cocoa)\b/],
    ['Baking', /\b(bread|focaccia|cake|cookies?|muffins?|scones?|pie|tart|brioche|loaf|biscuits?|galette)\b/],
    ['Sweets', /\b(pudding|pouding|mousse|ice cream|caramel|custard|dessert|brownies?|fudge|crumble|cobbler)\b/],
    ['Mains', /\b(spaghetti|pasta|linguine|penne|lasagna|risotto|curry|chicken|beef|pork|lamb|salmon|fish|tofu|burgers?|tacos?|shakshuka|dal|noodles?|stir.fry)\b/],
    ['Sides', /\b(salad|slaw|roasted|sauteed|wilted|glazed|carrots?|radish(es)?|chard|greens|potatoes|beans|squash|broccoli|asparagus|mash)\b/]
];

const guessCategory = (title) => (CATEGORY_GUESSES.find(([, re]) => re.test(fold(title))) || ['Other'])[0];

const slugify = (s) => fold(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const titleFromFile = (file) => clean(nfc(file).replace(/\.docx$/i, '').replace(/[_]+/g, ' '));

async function loadMeta() {
    try {
        const raw = JSON.parse(await readFile(META, 'utf8'));
        const meta = {};
        for (const [k, v] of Object.entries(raw)) meta[nfc(k).replace(/\.docx$/i, '').toLowerCase()] = v;
        return meta;
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw new Error('recipes/meta.json is not valid JSON: ' + err.message);
    }
}


/* Main */

async function parseDocx(file) {
    const zip = await JSZip.loadAsync(await readFile(path.join(DIR, file)));
    const read = (name) => (zip.file(name) ? zip.file(name).async('string') : null);
    const [docXml, stylesXml, numXml] = await Promise.all([read('word/document.xml'), read('word/styles.xml'), read('word/numbering.xml')]);
    if (!docXml) throw new Error('no word/document.xml');
    const paras = readParagraphs(parseXml(docXml), loadStyles(stylesXml), loadNumbering(numXml));
    return toRecipe(paras, titleFromFile(file));
}

async function main() {
    const meta = await loadMeta();
    const files = (await readdir(DIR))
        .filter((f) => /\.docx$/i.test(f) && !f.startsWith('~$') && !f.startsWith('.'))
        .sort((a, b) => a.localeCompare(b));

    const recipes = [];
    const slugs = new Set();
    let problems = 0;

    for (const file of files) {
        let r;
        try {
            r = await parseDocx(file);
        } catch (err) {
            console.warn('✗ ' + file + ': could not read it (' + err.message + ')');
            problems++;
            continue;
        }

        const m = meta[nfc(file).replace(/\.docx$/i, '').toLowerCase()] || {};
        if (m.hidden) continue;

        const title = m.title || r.title;
        let slug = m.slug || slugify(title);
        for (let i = 2; slugs.has(slug); i++) slug = slugify(title) + '-' + i;
        slugs.add(slug);

        const issues = [];
        if (!r.ingredients.length) issues.push('no ingredients found');
        if (!r.method.some((g) => g.steps.length)) issues.push('no steps found');
        if (issues.length) { problems++; console.warn('! ' + file + ': ' + issues.join(', ')); }
        else console.log('✓ ' + file);

        recipes.push({
            slug,
            title,
            category: m.category || guessCategory(title),
            by: m.by || null,
            story: m.story || null,
            time: Number(m.time) || null,
            serves: m.serves || r.servesHint || null,
            image: m.image || null,
            file: URL_BASE + encodeURIComponent(nfc(file)),
            ingredientsNote: r.ingredientsNote,
            ingredients: r.ingredients,
            method: r.method.filter((g) => g.steps.length),
            notes: r.notes
        });
    }

    recipes.sort((a, b) => a.title.localeCompare(b.title));
    await writeFile(OUT, JSON.stringify({ generated: new Date().toISOString(), recipes }, null, 2) + '\n');
    console.log('\nWrote ' + recipes.length + ' recipes to recipes/recipes.json' + (problems ? ' (' + problems + ' to check above)' : ''));
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
