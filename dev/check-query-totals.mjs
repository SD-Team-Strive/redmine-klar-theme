// Prüft in der Ticketliste die Spalten mit Stunden und die Summenzeile:
//   - Überschrift von Zahlenspalten (Aufgewendete Zeit, Geschätzter Aufwand …)
//     rechtsbündig wie die Werte darunter
//   - Summen ("Aufgewendete Zeit: 617:00") mit Abstand unter dem
//     Filterkasten und über der Tabelle, nicht darin oder daran klebend
// Anlass (20.11.2026, Prod): Überschrift links, Werte rechts; Summe saß auf
// der Unterkante des Filterkastens (Redmine: margin-top: -2.3em).
//
// Aufruf: node dev/check-query-totals.mjs [Basis-URL]

import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:3080';
const columns = ['spent_hours', 'estimated_hours', 'total_spent_hours'];
const query = new URLSearchParams([
  ['set_filter', '1'], ['f[]', 'status_id'], ['op[status_id]', '*'], ['group_by', 'project'],
  ['c[]', 'subject'], ...columns.map((column) => ['c[]', column]), ['t[]', 'spent_hours'],
]);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];

await page.goto(`${baseUrl}/login`);
await page.fill('#username', 'admin');
await page.fill('#password', 'admin');
await page.click('#login-submit');
await page.goto(`${baseUrl}/issues?${query}`);

const result = await page.evaluate((names) => {
  const headers = names.map((name) => {
    const th = document.querySelector(`table.list.issues th.${name}`);
    const td = document.querySelector(`table.list.issues td.${name}`);
    return { name, th: th && getComputedStyle(th).textAlign, td: td && getComputedStyle(td).textAlign };
  });
  const totals = document.querySelector('.query-totals');
  const form = document.querySelector('#query_form_with_buttons, #query_form');
  const table = document.querySelector('table.list.issues');
  return {
    headers,
    totals: totals && totals.getBoundingClientRect().top,
    totalsBottom: totals && totals.getBoundingClientRect().bottom,
    formBottom: form && form.getBoundingClientRect().bottom,
    tableTop: table && table.getBoundingClientRect().top,
  };
}, columns);

for (const header of result.headers) {
  if (!header.td) {
    failures.push(`Spalte ${header.name} fehlt in der Liste`);
  } else if (header.th !== header.td && !(header.th === 'end' && header.td === 'right')) {
    failures.push(`Spalte ${header.name}: Überschrift ${header.th}, Werte ${header.td}`);
  }
}

if (result.totals === null) {
  failures.push('Keine Summenzeile (.query-totals)');
} else {
  if (result.totals < result.formBottom + 4) {
    failures.push(`Summe beginnt ${Math.round(result.formBottom - result.totals)}px über der Unterkante des Filterkastens`);
  }
  if (result.totalsBottom > result.tableTop) {
    failures.push('Summe ragt in die Tabelle');
  }
}

await browser.close();

if (failures.length) {
  console.error(`Ticketliste, Summen und Zahlenspalten: ${failures.length} Fehler`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}
console.log('Ticketliste: Zahlenspalten rechtsbündig samt Überschrift, Summe frei zwischen Filter und Tabelle');
