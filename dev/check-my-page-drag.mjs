// Prüft auf "Meine Seite" das Verschieben von Blöcken in leere Spalten:
// Liegen alle Blöcke oben, müssen links und rechts beim Ziehen als
// gestrichelte Flächen erscheinen, auf die man einen Block ablegen kann.
// Anlass (20.11.2026, Prod): Spalten links/rechts leer → nur 2px hoch
// (Theme setzte Redmines padding-top: 15px auf 0), keine gestrichelte Linie,
// Blöcke ließen sich nur oben in voller Breite anordnen.
//
// Die Blöcke werden nur im DOM nach oben gelegt; Redmines Speichern der
// Anordnung (my/order_blocks) wird abgefangen – die echte "Meine Seite"
// bleibt unverändert.
//
// Aufruf: node dev/check-my-page-drag.mjs [Basis-URL]

import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:3080';
const MIN_DROP_HEIGHT = 80;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];

await page.goto(`${baseUrl}/login`);
await page.fill('#username', 'admin');
await page.fill('#password', 'admin');
await page.click('#login-submit');
await page.route('**/my/order_blocks', (route) => route.abort());
await page.goto(`${baseUrl}/my/page`);

const blockCount = await page.locator('.mypage-box').count();
if (!blockCount) {
  failures.push('Keine Blöcke auf Meine Seite');
} else {
  await page.evaluate(() => {
    const top = document.querySelector('#list-top');
    document.querySelectorAll('#list-left > *, #list-right > *').forEach((block) => top.appendChild(block));
    window.jQuery('.block-receiver').sortable('refresh');
  });

  const block = page.locator('#list-top > .mypage-box').first();
  await block.hover();
  const handle = await block.locator('.sort-handle').boundingBox();
  await page.mouse.move(handle.x + 5, handle.y + 5);
  await page.mouse.down();
  await page.mouse.move(handle.x + 20, handle.y + 60, { steps: 8 });

  const columns = await page.evaluate(() => ['left', 'right'].map((group) => {
    const column = document.querySelector(`#list-${group}`);
    const style = getComputedStyle(column);
    return {
      group,
      height: Math.round(column.getBoundingClientRect().height),
      border: `${style.borderTopStyle} ${style.borderTopColor}`,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  }));

  for (const column of columns) {
    if (column.height < MIN_DROP_HEIGHT) {
      failures.push(`Spalte ${column.group} beim Ziehen ${column.height}px hoch (mindestens ${MIN_DROP_HEIGHT})`);
    }
    if (!column.border.startsWith('dashed') || column.border.includes('rgba(0, 0, 0, 0)')) {
      failures.push(`Spalte ${column.group} beim Ziehen ohne sichtbare gestrichelte Linie (${column.border})`);
    }
  }

  await page.mouse.up();
  await page.waitForTimeout(300);
}

await browser.close();

if (failures.length) {
  console.error(`Meine Seite, Verschieben: ${failures.length} Fehler`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}
console.log('Meine Seite, Verschieben: leere Spalten sind beim Ziehen sichtbare Ablageflächen');
