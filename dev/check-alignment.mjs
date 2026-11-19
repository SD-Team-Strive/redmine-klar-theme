// Prüft die vertikale Ausrichtung von Icons und Elementen in einer Zeile.
// Aufruf: node dev/check-alignment.mjs [filter] [--mobile] [--tolerance=1]
//
// Gemessen wird:
//  1. Icon zu Text: Mitte des SVG gegen Mitte des Textes im selben
//     Element (.icon, Buttons, Menüeinträge, Legenden, Badges …)
//  2. Elemente einer Zeile: Mitten aller sichtbaren Kinder gegeneinander
//     (Aktionen der Titelzeile, Filter-Fußzeile, Journal-Köpfe …)
// Gemeldet wird alles, was mehr als die Toleranz (px) abweicht.

import { chromium } from 'playwright';

const baseUrl = process.env.REDMINE_URL ?? 'http://localhost:3080';
const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const filter = args.find((arg) => !arg.startsWith('--'));
const tolerance = Number(args.find((arg) => arg.startsWith('--tolerance='))?.split('=')[1] ?? 1);
const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const pages = [
  ['home', '/'],
  ['projects', '/projects'],
  ['project-overview', '/projects/website-relaunch'],
  ['issues', '/projects/website-relaunch/issues'],
  ['issue', '/issues/1'],
  ['issue-new', '/projects/website-relaunch/issues/new'],
  ['activity', '/projects/website-relaunch/activity'],
  ['roadmap', '/projects/website-relaunch/roadmap'],
  ['version', '/versions/1'],
  ['gantt', '/projects/website-relaunch/issues/gantt'],
  ['calendar', '/projects/website-relaunch/issues/calendar'],
  ['time-entries', '/projects/website-relaunch/time_entries'],
  ['wiki', '/projects/website-relaunch/wiki'],
  ['wiki-edit', '/projects/website-relaunch/wiki/Wiki/edit'],
  ['news', '/projects/website-relaunch/news'],
  ['boards', '/projects/website-relaunch/boards/1'],
  ['board-topic', '/boards/1/topics/1'],
  ['documents', '/projects/website-relaunch/documents'],
  ['project-settings', '/projects/website-relaunch/settings'],
  ['my-page', '/my/page'],
  ['my-account', '/my/account'],
  ['admin', '/admin'],
  ['admin-users', '/users'],
  ['admin-settings', '/settings'],
  ['search', '/search?q=header'],
];

// Elemente mit Icon + Text
const iconSelectors = [
  'a.icon', 'span.icon', 'button.icon', '.icon-only',
  'legend.icon', 'h3 > svg', 'h3.icon',
  '.drdn-items > a', '#context-menu a', '.dropdown-content a',
  '#admin-menu a', 'ul.queries a',
  '.badge', 'label:has(> input[type="checkbox"])',
];

// Container, deren Kinder auf einer Linie liegen sollen
const rowSelectors = [
  '#content > .contextual', '.contextual', '#query_form_with_buttons > p.buttons',
  '.journal-header', '.journal-actions', '.journal-meta',
  '#top-menu .profile-menu', '#main-menu > ul', '.tabs ul',
  '.jstElements', 'p.buttons', '.next-prev-links ul.pages',
  'span.pagination', '.add-filter', '#filters-table .filter',
  'div.issue .subject', '#sidebar-wrapper > .contextual + h3',
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'de-DE' });
const page = await context.newPage();

await page.goto(`${baseUrl}/login`);
await page.fill('#username', 'admin');
await page.fill('#password', 'admin');
await page.click('#login-submit');

let total = 0;

for (const [name, path] of pages) {
  if (filter && !name.includes(filter)) continue;
  await page.goto(`${baseUrl}${path}`);

  const findings = await page.evaluate(({ iconSelectors, rowSelectors, tolerance }) => {
    const out = [];
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // nur für Screenreader sichtbare Texte (1px, clip) zählen nicht
      const srOnly = r.width <= 1 && r.height <= 1;
      return r.width > 0 && r.height > 0 && !srOnly && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const describe = (el) => {
      const parts = [];
      let node = el;
      for (let i = 0; node && i < 3 && node !== document.body; i++) {
        let part = node.tagName.toLowerCase();
        if (node.id) part += `#${node.id}`;
        else if (node.classList.length) part += '.' + [...node.classList].slice(0, 2).join('.');
        parts.unshift(part);
        node = node.parentElement;
      }
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      return `${parts.join(' > ')}${text ? ` "${text}"` : ''}`;
    };
    // Mitte der sichtbaren Textzeile(n), ohne SVG
    const textCenter = (el) => {
      const range = document.createRange();
      const rects = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        if (node.parentElement.closest('svg')) continue;
        if (!visible(node.parentElement)) continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) rects.push(r);
      }
      if (!rects.length) return null;
      // erste Zeile zählt (Icon steht vor der ersten Zeile)
      const first = rects.reduce((a, b) => (a.top <= b.top ? a : b));
      const sameLine = rects.filter((r) => Math.abs(r.top - first.top) < 2);
      const top = Math.min(...sameLine.map((r) => r.top));
      const bottom = Math.max(...sameLine.map((r) => r.bottom));
      return (top + bottom) / 2;
    };
    const center = (el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    };

    // 1. Icon zu Text
    const seen = new Set();
    for (const el of document.querySelectorAll(iconSelectors.join(','))) {
      if (seen.has(el) || !visible(el)) continue;
      seen.add(el);
      const svg = el.querySelector(':scope > svg, :scope > * > svg');
      const tc = textCenter(el);
      if (!svg || !visible(svg) || tc === null) continue;
      const diff = center(svg) - tc;
      if (Math.abs(diff) > tolerance) {
        out.push({ kind: 'Icon/Text', diff: Math.round(diff * 10) / 10, where: describe(el) });
      }
    }

    // 2. Elemente einer Zeile
    for (const row of document.querySelectorAll(rowSelectors.join(','))) {
      if (!visible(row)) continue;
      const items = [...row.children].filter((c) => visible(c) && c.tagName !== 'SCRIPT');
      if (items.length < 2) continue;
      // nur Elemente auf derselben Zeile vergleichen (Umbruch erlaubt)
      const lines = [];
      for (const item of items) {
        const r = item.getBoundingClientRect();
        const line = lines.find((l) => r.top < l.bottom && r.bottom > l.top);
        if (line) {
          line.items.push(item);
          line.top = Math.min(line.top, r.top);
          line.bottom = Math.max(line.bottom, r.bottom);
        } else {
          lines.push({ top: r.top, bottom: r.bottom, items: [item] });
        }
      }
      for (const line of lines) {
        if (line.items.length < 2) continue;
        // Bezug: Mitte des Textes bzw. des Elements
        const centers = line.items.map((i) => {
          const tc = textCenter(i);
          return { el: i, c: tc ?? center(i) };
        });
        const ref = centers[0].c;
        for (const { el, c } of centers.slice(1)) {
          const diff = c - ref;
          if (Math.abs(diff) > tolerance) {
            out.push({
              kind: 'Zeile',
              diff: Math.round(diff * 10) / 10,
              where: `${describe(row)} :: ${describe(el)} zu ${describe(centers[0].el)}`,
            });
          }
        }
      }
    }
    // 3. Titelzeile über Container hinweg: Titel, Aktionen, Einklapp-Button
    const title = document.querySelector('#content > h2');
    if (title && visible(title)) {
      const ref = textCenter(title);
      const others = [
        ...document.querySelectorAll('#content > .contextual:not(h2 ~ .contextual) > *'),
        document.querySelector('#sidebar-switch-button'),
      ].filter((el) => el && visible(el));
      for (const el of others) {
        const r = el.getBoundingClientRect();
        // nur Elemente, die neben dem Titel stehen (nicht umgebrochen)
        const t = title.getBoundingClientRect();
        if (r.bottom < t.top || r.top > t.bottom) continue;
        const diff = center(el) - ref;
        if (Math.abs(diff) > tolerance) {
          out.push({ kind: 'Titelzeile', diff: Math.round(diff * 10) / 10, where: `${describe(el)} zu ${describe(title)}` });
        }
      }
    }

    return out;
  }, { iconSelectors, rowSelectors, tolerance });

  // gleiche Befunde (z. B. jede Tabellenzeile) zusammenfassen
  const grouped = new Map();
  for (const f of findings) {
    const key = `${f.kind}|${f.diff}|${f.where.replace(/"[^"]*"/g, '')}`;
    const entry = grouped.get(key) ?? { ...f, count: 0 };
    entry.count++;
    grouped.set(key, entry);
  }

  if (grouped.size) {
    console.log(`\n## ${name} (${path})`);
    for (const f of grouped.values()) {
      console.log(`  ${f.kind.padEnd(9)} ${String(f.diff).padStart(5)}px  ${f.where}${f.count > 1 ? `  (${f.count}×)` : ''}`);
    }
    total += grouped.size;
  }
}

// -----------------------------------------------------------------------------
// Überlagerung (nur mobil): Seite scrollen, Menü öffnen, prüfen, ob ein
// fixiertes Element des Inhalts über dem Menü liegt (z. B. die Ticket-
// Kopfzeile, die erst beim Scrollen erscheint)
// -----------------------------------------------------------------------------

if (mobile && (!filter || 'overlap'.includes(filter) || filter.includes('issue'))) {
  for (const path of ['/issues/1', '/projects/website-relaunch/wiki']) {
    await page.goto(`${baseUrl}${path}`);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(400);
    await page.click('.mobile-toggle-button');
    await page.waitForTimeout(400);

    const covering = await page.evaluate(() => {
      const menu = document.querySelector('.flyout-menu').getBoundingClientRect();
      const found = new Set();
      // Raster über die sichtbare Menüfläche: was liegt zuoberst?
      for (let y = 70; y < Math.min(window.innerHeight, menu.bottom); y += 40) {
        for (let x = Math.max(menu.left, 0) + 10; x < menu.right; x += 60) {
          const top = document.elementFromPoint(x, y);
          if (top && !top.closest('.flyout-menu, #header')) {
            const fixed = top.closest('*') && [...function* () {
              for (let el = top; el && el !== document.body; el = el.parentElement) yield el;
            }()].find((el) => getComputedStyle(el).position === 'fixed');
            found.add(fixed ? `${fixed.tagName.toLowerCase()}#${fixed.id || '?'}.${fixed.className}`.slice(0, 80) : `${top.tagName.toLowerCase()}.${top.className}`.slice(0, 80));
          }
        }
      }
      return [...found];
    });

    if (covering.length) {
      console.log(`\n## Überlagerung (${path}, gescrollt, Menü offen)`);
      for (const c of covering) console.log(`  über dem Menü: ${c}`);
      total += covering.length;
    }
    await page.click('.mobile-toggle-button').catch(() => {});
  }
}

// -----------------------------------------------------------------------------
// Ticket-Navigation "‹ 12/17 ›" darf die Autorzeile nicht überdecken.
// Die Navigation erscheint nur, wenn das Ticket aus einer Liste aufgerufen
// wird. Anlass: Redmine 6.1 liefert anderes Markup ("« Zurück | 12/17 |
// Weiter »"), das mobil über dem Text lag – die Mittellinien-Prüfung oben
// fängt so etwas nicht.
// -----------------------------------------------------------------------------

if (!filter || filter.includes('issue') || 'overlap'.includes(filter)) {
  for (const id of [1, 7]) {
    await page.goto(`${baseUrl}/projects/website-relaunch/issues`);
    await page.goto(`${baseUrl}/issues/${id}`);
    await page.waitForTimeout(300);

    const overlaps = await page.evaluate(() => {
      const nav = document.querySelector('div.issue.details > .next-prev-links');
      const author = document.querySelector('div.issue.details p.author');
      if (!nav || !author || !nav.offsetParent) return [];
      const box = nav.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(author);
      return [...range.getClientRects()]
        .filter((r) => r.width > 0 && r.right > box.left + 1 && r.left < box.right - 1
          && r.bottom > box.top + 1 && r.top < box.bottom - 1)
        .map((r) => `Text ${Math.round(r.left)}–${Math.round(r.right)} / Navigation ${Math.round(box.left)}–${Math.round(box.right)}`);
    });

    if (overlaps.length) {
      console.log(`\n## Ticket-Navigation überdeckt Autorzeile (/issues/${id})`);
      for (const o of overlaps) console.log(`  ${o}`);
      total += overlaps.length;
    }
  }
}

await browser.close();
console.log(`\n${total} Befunde (Toleranz ${tolerance}px, ${mobile ? 'mobil' : 'Desktop'})`);
process.exit(total ? 1 : 0);
