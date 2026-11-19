// Screenshots für die README (docs/screenshots/).
// Aufruf: npm run screenshots:readme  (lokale Testinstanz mit dev/seed.rb)
//
// Zeigt das Theme so, wie es öffentlich ausgeliefert wird: ein eigenes Logo
// der Installation (images/logo.* im Theme oder /klar/logo vom Plugin) wird
// blockiert, im Kopf erscheint die Fallback-Kachel.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.env.REDMINE_URL ?? 'http://localhost:3080';
const outDir = 'docs/screenshots';

const shots = [
  { name: 'issues', path: '/projects/website-relaunch/issues', device: 'desktop' },
  { name: 'issue', path: '/issues/16', device: 'desktop' },
  { name: 'editor', path: '/projects/website-relaunch/wiki/Wiki/edit?section=2', device: 'desktop', wait: 1200 },
  { name: 'roadmap', path: '/projects/website-relaunch/roadmap', device: 'desktop' },
  { name: 'activity', path: '/projects/website-relaunch/activity', device: 'desktop' },
  { name: 'mobile-issue', path: '/issues/16', device: 'mobile' },
  { name: 'mobile-issues', path: '/projects/website-relaunch/issues', device: 'mobile' },
  {
    name: 'mobile-menu',
    path: '/projects/website-relaunch/issues',
    device: 'mobile',
    action: async (page) => page.click('.mobile-toggle-button'),
  },
];

const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let failures = 0;

for (const [device, options] of Object.entries(devices)) {
  const context = await browser.newContext({ ...options, locale: 'de-DE' });
  await context.route(/\/themes\/[^/]+\/logo[^/]*\.(png|svg|jpe?g|webp)|\/klar\/logo/, (route) => route.abort());
  const page = await context.newPage();

  await page.goto(`${baseUrl}/login`);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin');
  await page.click('#login-submit');

  for (const shot of shots.filter((entry) => entry.device === device)) {
    try {
      await page.goto(`${baseUrl}${shot.path}`);
      await page.waitForTimeout(shot.wait ?? 400);
      if (shot.action) {
        await shot.action(page);
        await page.waitForTimeout(500);
      }
      const file = `${outDir}/${shot.name}.png`;
      await page.screenshot({ path: file });
      console.log(file);
    } catch (error) {
      failures++;
      console.error(`FEHLER ${shot.name}: ${error.message.split('\n')[0]}`);
    }
  }

  await context.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
