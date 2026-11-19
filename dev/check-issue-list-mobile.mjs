// Prüft die mobile Ticketliste (js/issueListMobile.js, scss/mobile/_lists.scss)
//
//   1. Gruppierung und Filter auf genau einen Wert blenden die Spalte aus
//      (nach Status gruppiert, "Zugewiesen an: ich" → Status, Zuständiger)
//   2. Ohne diese Festlegung bleiben Status und Zuständiger (als Initialen)
//   3. "⋯" immer sichtbar, Checkbox erst nach "Auswählen"
//   4. Tippen auf die Zeile öffnet das Ticket
//   5. Langer Druck öffnet das Kontextmenü und nicht das Ticket
//
// Aufruf: node dev/check-issue-list-mobile.mjs [Basis-URL]

import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:3080';
const columns = ['project', 'tracker', 'status', 'priority', 'subject', 'assigned_to', 'updated_on']
  .map((column) => `c[]=${column}`).join('&');
const listPath = '/projects/website-relaunch/issues?set_filter=1&f[]=status_id&op[status_id]=o';
const mineGrouped = `${listPath}&f[]=assigned_to_id&op[assigned_to_id]==&v[assigned_to_id][]=me&group_by=status&${columns}`;
const allOpen = `${listPath}&${columns}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'de-DE' });
const page = await context.newPage();
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const visible = (selector) => page.evaluate((s) => [...document.querySelectorAll(s)]
  .some((element) => element.getBoundingClientRect().width > 0), selector);

await page.goto(`${baseUrl}/login`);
await page.fill('#username', 'admin');
await page.fill('#password', 'admin');
await page.click('#login-submit');

// 1. Festgelegte Spalten entfallen
await page.goto(`${baseUrl}${mineGrouped}`);
await page.waitForTimeout(300);
const hidden = await page.evaluate(() => document.querySelector('#content table.list.issues')?.dataset.mobileHide || '');
expect(hidden.split(' ').includes('status'), `nach Status gruppiert: Status nicht als überflüssig erkannt ("${hidden}")`);
expect(hidden.split(' ').includes('assigned_to'), `"Zugewiesen an: ich": Zuständiger nicht als überflüssig erkannt ("${hidden}")`);
expect(!(await visible('#content tr.issue > td.status')), 'Status ist trotz Gruppierung sichtbar');
expect(!(await visible('#content tr.issue > td.assigned_to')), 'Zuständiger ist trotz Filter sichtbar');

// 2. Ohne Festlegung bleiben sie
await page.goto(`${baseUrl}${allOpen}`);
await page.waitForTimeout(300);
expect(await visible('#content tr.issue > td.status'), 'alle offenen: Status fehlt');
expect(await visible('#content tr.issue .list-user-initials'), 'alle offenen: Initialen des Zuständigen fehlen');

// 3. Auswahl erst auf Wunsch
expect(!(await visible('#content tr.issue > td.checkbox')), 'Checkbox ohne "Auswählen" sichtbar');
expect(await visible('#content tr.issue > td.buttons'), '"⋯" ohne "Auswählen" nicht sichtbar');
// "⋯" darf den Text der Zeile nicht überdecken
const overlap = await page.evaluate(() => [...document.querySelectorAll('#content tr.issue')].slice(0, 5).some((row) => {
  const button = row.querySelector('td.buttons').getBoundingClientRect();
  return [...row.querySelectorAll(':scope > td:not(.buttons, .checkbox, .priority)')].some((cell) => {
    const range = document.createRange();
    range.selectNodeContents(cell);
    return [...range.getClientRects()].some((r) => r.width > 0 && r.right > button.left + 1 && r.top < button.bottom && r.bottom > button.top);
  });
}));
expect(!overlap, '"⋯" überdeckt Text der Zeile');
await page.click('.issue-list-select-toggle');
expect(await visible('#content tr.issue > td.checkbox'), 'Checkbox nach "Auswählen" nicht sichtbar');
await page.click('.issue-list-select-toggle');

// 4. Tippen auf die Zeile (neben dem Titel) öffnet das Ticket
const row = page.locator('#content tr.issue').first();
const issueHref = await row.locator('td.subject a').getAttribute('href');
const box = await row.boundingBox();
await Promise.all([
  page.waitForURL((url) => url.pathname === issueHref, { timeout: 5000 }).catch(() => {}),
  page.touchscreen.tap(box.x + box.width - 60, box.y + box.height - 12),
]);
expect(new URL(page.url()).pathname === issueHref, `Tippen auf die Zeile öffnet nicht ${issueHref}, sondern ${page.url()}`);

// 5. Langer Druck: Kontextmenü statt Ticket
await page.goto(`${baseUrl}${allOpen}`);
await page.waitForTimeout(300);
const pressBox = await page.locator('#content tr.issue td.subject a').first().boundingBox();
const point = { x: pressBox.x + 20, y: pressBox.y + pressBox.height / 2 };
const cdp = await context.newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
await page.waitForTimeout(700);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(800);
expect(page.url().includes('/issues?'), `langer Druck öffnet das Ticket (${page.url()})`);
expect(await visible('#context-menu ul'), 'langer Druck öffnet kein Kontextmenü');

// 6. Meta-Angaben: feste Zeilen (wer/wo, Zustand/Zeit), Texte einer Zeile
//    auf einer Mitte. Anlass (19.11.2026): Der Projektlink mit Projekt-Icon
//    (inline-flex) saß auf der Grundlinie, sein Text 2px über "#43".
const metaLines = () => page.evaluate(() => [...document.querySelectorAll('table.list.issues tr.issue')].slice(0, 5).map((row) => {
  const texts = [];
  row.querySelectorAll(':scope > td:not(.subject, .priority, .checkbox, .buttons)').forEach((cell) => {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      // Name hinter den Initialen ist nur für Screenreader (Rechteck trotz clip-path)
      if (node.parentElement.closest('.list-user-name')) {
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (node.textContent.trim() && rect.width > 1 && rect.height > 1) {
        texts.push({ cell: cell.className.split(' ')[0], center: rect.top + rect.height / 2 });
      }
    }
  });
  return texts;
}));

for (const path of [allOpen, '/my/page']) {
  await page.goto(`${baseUrl}${path}`);
  await page.waitForTimeout(300);
  for (const texts of await metaLines()) {
    const lines = [];
    texts.forEach((text) => {
      const line = lines.find((l) => Math.abs(l.center - text.center) < 6);
      line ? line.items.push(text) : lines.push({ center: text.center, items: [text] });
    });
    lines.forEach((line) => {
      const centers = line.items.map((item) => item.center);
      const spread = Math.max(...centers) - Math.min(...centers);
      expect(spread <= 1, `${path}: Meta-Zeile nicht auf einer Mitte (${spread.toFixed(1)}px: ${line.items.map((i) => i.cell).join(', ')})`);
    });
    const top = (cell) => texts.find((t) => t.cell === cell)?.center;
    if (top('status') && (top('project') || top('id'))) {
      expect(top('status') > (top('project') ?? top('id')) + 6, `${path}: Status steht nicht unter Projekt/Nummer`);
    }
  }
}

// 7. Flucht: Titel bündig mit dem Namen der Gruppenüberschrift (Ticketliste)
//    bzw. dem Block-Titel (Meine Seite); der Punkt davor, innerhalb der
//    Karte. Anlass (19.11.2026): Punkt sollte an den Rand, der Titel in eine
//    Flucht mit der Überschrift.
const textLeft = (selector) => page.evaluate((s) => {
  const element = document.querySelector(s);
  if (!element) return null;
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getClientRects()[0]?.left ?? null;
}, selector);

await page.goto(`${baseUrl}${listPath}&group_by=status&${columns}`);
await page.waitForTimeout(300);
const groupName = await textLeft('#content tr.group .name');
const listTitle = await textLeft('#content tr.issue td.subject a');
expect(groupName !== null && Math.abs(groupName - listTitle) <= 1,
  `Ticketliste: Titel (${listTitle?.toFixed(1)}) nicht bündig mit Gruppenname (${groupName?.toFixed(1)})`);
const listDot = await page.evaluate(() => {
  const row = document.querySelector('#content tr.issue');
  const dot = row.querySelector('td.priority').getBoundingClientRect();
  const card = row.getBoundingClientRect();
  return { inside: dot.left >= card.left + 2, gap: row.querySelector('td.subject').getBoundingClientRect().left - dot.right };
});
expect(listDot.inside && listDot.gap > 0, `Ticketliste: Punkt nicht am Rand vor dem Titel (${JSON.stringify(listDot)})`);

await page.goto(`${baseUrl}/my/page`);
await page.waitForTimeout(300);
// Gruppierter Block ("Tickets" mit gruppierter Abfrage): je Gruppe eine
// Karte mit Rahmen – Titel bündig mit dem Gruppennamen, nicht am Rahmen.
// Anlass (19.11.2026): Text klebte am linken Rahmen.
const groupedBox = '.mypage-box:has(table.list.issues tr.group)';
const boxGroupName = await textLeft(`${groupedBox} tr.group .name`);
if (boxGroupName !== null) {
  const boxGroupTitle = await textLeft(`${groupedBox} tr.issue td.subject a`);
  expect(Math.abs(boxGroupName - boxGroupTitle) <= 1,
    `Meine Seite, gruppiert: Titel (${boxGroupTitle?.toFixed(1)}) nicht bündig mit Gruppenname (${boxGroupName.toFixed(1)})`);
}

const plainBox = '.mypage-box:has(table.list.issues):not(:has(tr.group))';
const blockTitle = await textLeft(`${plainBox} h3`);
const blockRow = await textLeft(`${plainBox} table.list.issues tr.issue td.subject a`);
if (blockTitle !== null && blockRow !== null) {
  expect(Math.abs(blockTitle - blockRow) <= 1,
    `Meine Seite: Titel (${blockRow.toFixed(1)}) nicht bündig mit Block-Titel (${blockTitle.toFixed(1)})`);
  // Nur Blöcke mit Spalte "Priorität" haben einen Punkt
  const boxDot = await page.evaluate(() => {
    const row = document.querySelector('.mypage-box:not(:has(tr.group)) table.list.issues tr.issue:has(> td.priority)');
    if (!row) return true;
    const dot = row.querySelector('td.priority').getBoundingClientRect();
    return dot.left >= row.closest('.mypage-box').getBoundingClientRect().left + 2 && dot.right < row.querySelector('td.subject').getBoundingClientRect().left;
  });
  expect(boxDot, 'Meine Seite: Punkt nicht im Innenabstand der Karte vor dem Titel');
}

await browser.close();

if (failures.length) {
  console.error(`Ticketliste mobil: ${failures.length} Abweichung(en)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('Ticketliste mobil: Überflüssiges ausgeblendet, Auswahl auf Wunsch, Tippen und langer Druck');
