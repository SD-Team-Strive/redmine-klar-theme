// Prüft die Dialoge (jQuery UI, Redmines showModal) – Desktop und mobil:
//   Schließen-Knopf beschriftet (nicht "Close"), Breite höchstens 760px bzw.
//   Bildschirm, Checkboxen in voller Größe, keine zweite Karte (.box) im
//   Dialog, Kontextmenü geschlossen.
// Anlass (19.11.2026): graue Titelleiste mit Bild-Icon, "Neues Mitglied"
// fast bildschirmbreit, Checkbox "Übergeordnete Seite" mobil 2px breit
// (responsive.css; die Korrektur galt nur unter #content).
//
// Aufruf: node dev/check-dialogs.mjs [Basis-URL]

import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:3080';
const dialogs = [
  ['Beobachter', '/issues/1', '#watchers a[href*="watchers/new"]'],
  ['CSV-Export', '/projects/website-relaunch/issues', 'a.csv'],
  ['Neue Kategorie', '/projects/website-relaunch/issues/new', 'a.icon-add[href*="issue_categories/new"]'],
  ['Neues Mitglied', '/projects/website-relaunch/settings/members', 'a[href*="memberships/new"]'],
  ['Neue Wiki-Seite', '/projects/website-relaunch/wiki', 'a.icon-add[href*="wiki/new"]'],
];
const devices = [
  ['Desktop', { viewport: { width: 1440, height: 900 } }],
  ['mobil', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
];

const browser = await chromium.launch();
const failures = [];

for (const [device, options] of devices) {
  const page = await browser.newPage(options);
  await page.goto(`${baseUrl}/login`);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin');
  await page.click('#login-submit');

  for (const [name, path, opener] of dialogs) {
    await page.goto(`${baseUrl}${path}`);
    await page.waitForTimeout(300);
    // per DOM-Klick: manche Auslöser liegen im "⋯"-Menü oder sind mobil verdeckt
    const found = await page.evaluate((selector) => {
      const link = document.querySelector(selector);
      link?.click();
      return Boolean(link);
    }, opener);
    if (!found) {
      failures.push(`${device}, ${name}: Auslöser ${opener} nicht gefunden`);
      continue;
    }
    try {
      await page.waitForSelector('.ui-dialog.modal', { state: 'visible', timeout: 5000 });
    } catch {
      failures.push(`${device}, ${name}: Dialog öffnet nicht`);
      continue;
    }
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const dialog = document.querySelector('.ui-dialog.modal');
      const close = dialog.querySelector('.ui-dialog-titlebar-close');
      const checks = [...dialog.querySelectorAll('input[type="checkbox"]')]
        .filter((input) => input.offsetParent)
        .map((input) => Math.round(input.getBoundingClientRect().width));
      const boxes = [...dialog.querySelectorAll('.box')]
        .filter((box) => parseFloat(getComputedStyle(box).borderTopWidth) > 0).length;
      const menu = document.querySelector('#context-menu');
      return {
        width: Math.round(dialog.getBoundingClientRect().width),
        closeTitle: close?.getAttribute('title') || '',
        smallChecks: checks.filter((width) => width < 14),
        boxes,
        menuOpen: Boolean(menu && menu.offsetParent && menu.querySelector('ul')),
      };
    });

    const maxWidth = device === 'mobil' ? options.viewport.width - 32 : 762;
    if (result.width > maxWidth) failures.push(`${device}, ${name}: ${result.width}px breit (höchstens ${maxWidth})`);
    if (!result.closeTitle || result.closeTitle === 'Close') failures.push(`${device}, ${name}: Schließen-Knopf "${result.closeTitle}"`);
    if (result.smallChecks.length) failures.push(`${device}, ${name}: Checkbox ${result.smallChecks.join(', ')}px breit`);
    if (result.boxes) failures.push(`${device}, ${name}: ${result.boxes} umrandete .box im Dialog`);
    if (result.menuOpen) failures.push(`${device}, ${name}: Kontextmenü offen`);
  }
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error(`Dialoge: ${failures.length} Abweichung(en)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Dialoge: ${dialogs.length} geprüft (Desktop, mobil) – Breite, Schließen, Checkboxen, keine zweite Karte`);
