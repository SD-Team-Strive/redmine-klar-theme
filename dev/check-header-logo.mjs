// Regression: Logo-Kachel im Kopf auf Projektseiten mit Projekt-Icon
//
// Symptom (19.11.2026): Mobil ersetzte das Projekt-Icon das Logo – damit
// fehlte innerhalb von Projekten der Weg zurück zur Startseite, und das Icon
// im Auslöser der Projektauswahl war ausgeblendet. Erwartet:
//   Desktop  Kachel zeigt das Projekt-Icon (Logo ausgeblendet)
//   Mobil    Kachel zeigt das Logo, Projekt-Icon steht in der Projektauswahl
//
// Aufruf: node dev/check-header-logo.mjs [Basis-URL] [Projekt mit Icon]
// (läuft in dev/plugin-screenshots/run.sh mit)

import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:3080';
const project = process.argv[3] ?? 'nordlicht';

const expectations = {
  desktop: { viewport: { width: 1440, height: 900 }, instance: false, project: true, trigger: true },
  mobile: { viewport: { width: 390, height: 844 }, instance: true, project: false, trigger: true },
};

const browser = await chromium.launch();
const failures = [];

for (const [device, expected] of Object.entries(expectations)) {
  const page = await browser.newPage({ viewport: expected.viewport });
  await page.goto(`${baseUrl}/login`);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin');
  await page.click('#login-submit');
  await page.goto(`${baseUrl}/projects/${project}/issues`);
  await page.waitForTimeout(300);

  const actual = await page.evaluate(() => {
    const visible = (selector) => [...document.querySelectorAll(selector)]
      .some((element) => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== 'hidden');
    return {
      instance: visible('#header > .theme-logo .theme-logo-instance'),
      project: visible('#header > .theme-logo .theme-logo-project'),
      trigger: visible('#project-jump .drdn-trigger .project-icon'),
    };
  });

  for (const key of ['instance', 'project', 'trigger']) {
    if (actual[key] !== expected[key]) {
      failures.push(`${device}: ${key} sichtbar=${actual[key]}, erwartet ${expected[key]}`);
    }
  }
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error(`Kopf-Logo: ${failures.length} Abweichung(en)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('Kopf-Logo: Desktop Projekt-Icon, mobil Logo + Icon in der Projektauswahl');
