// Screenshots der Plugins (mit Theme Klar und erfundenen Daten) in die
// Plugin-Repositories: <plugin>/docs/screenshots/*.png
// Aufruf über dev/plugin-screenshots/run.sh (erwartet die Instanz auf :3091)

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.REDMINE_URL ?? 'http://localhost:3091';
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const issueList = '/issues?set_filter=1&f[]=status_id&op[status_id]=o&c[]=project&c[]=tracker&c[]=status&c[]=priority&c[]=subject&c[]=assigned_to&c[]=updated_on&sort=project,id';

const shots = [
  // Branding
  { repo: 'redmine-branding', name: 'header', path: '/projects', device: 'desktop', clip: { height: 260 } },
  { repo: 'redmine-branding', name: 'login', path: '/login', device: 'desktop', anonymous: true },
  { repo: 'redmine-branding', name: 'settings', path: '/admin/branding', device: 'desktop' },
  { repo: 'redmine-branding', name: 'mobile-login', path: '/login', device: 'mobile', anonymous: true },
  // Avatars
  { repo: 'redmine-avatars', name: 'issue', path: '/issues/1', device: 'desktop' },
  { repo: 'redmine-avatars', name: 'change-avatar', path: '/my/avatar', device: 'desktop' },
  { repo: 'redmine-avatars', name: 'mobile-issue', path: '/issues/1', device: 'mobile', scroll: '#history' },
  // Project Icons
  { repo: 'redmine-project-icons', name: 'projects', path: '/projects', device: 'desktop' },
  { repo: 'redmine-project-icons', name: 'issues', path: issueList, device: 'desktop' },
  {
    repo: 'redmine-project-icons', name: 'project-selector', path: '/projects/nordlicht-shop/issues', device: 'desktop',
    action: async (page) => page.click('#project-jump .drdn-trigger'),
  },
  { repo: 'redmine-project-icons', name: 'settings', path: '/projects/nordlicht/settings/project_icon', device: 'desktop' },
  {
    repo: 'redmine-project-icons', name: 'calendar', path: '/projects/nordlicht/issues/calendar', device: 'desktop',
    // Woche mit den Einträgen oben im Bild
    action: async (page) => page.evaluate(() => {
      const today = document.querySelector('.cal .today');
      window.scrollTo(0, today.getBoundingClientRect().top + window.scrollY - 140);
    }),
  },
  { repo: 'redmine-project-icons', name: 'mobile-issues', path: `/projects/nordlicht${issueList}`, device: 'mobile' },
];

const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

// Deutsche Browser-Oberfläche (z. B. "Datei auswählen" statt "Choose File")
// (nur der volle Chromium-Kanal übernimmt die Sprache, die Headless-Shell nicht)
const browser = await chromium.launch({ channel: 'chromium', args: ['--lang=de-DE'] });
let failures = 0;

for (const [device, options] of Object.entries(devices)) {
  for (const anonymous of [false, true]) {
    const list = shots.filter((shot) => shot.device === device && Boolean(shot.anonymous) === anonymous);
    if (!list.length) continue;

    const context = await browser.newContext({ ...options, locale: 'de-DE' });
    const page = await context.newPage();
    if (!anonymous) {
      await page.goto(`${baseUrl}/login`);
      await page.fill('#username', 'admin');
      await page.fill('#password', 'admin');
      await page.click('#login-submit');
    }

    for (const shot of list) {
      try {
        await page.goto(`${baseUrl}${shot.path}`);
        await page.waitForTimeout(500);
        if (shot.scroll) {
          await page.locator(shot.scroll).first().scrollIntoViewIfNeeded().catch(() => {});
        }
        // Kein Fokusrahmen von Redmines Autofokus im Bild (Anmeldung ausgenommen)
        if (!shot.anonymous) {
          await page.evaluate(() => document.activeElement?.blur());
        }
        if (shot.action) {
          await shot.action(page);
          await page.waitForTimeout(500);
        }

        const outDir = resolve(workspace, shot.repo, 'docs/screenshots');
        mkdirSync(outDir, { recursive: true });
        const file = resolve(outDir, `${shot.name}.png`);
        const clip = shot.clip ? { x: 0, y: 0, width: options.viewport.width, height: shot.clip.height } : undefined;
        await page.screenshot({ path: file, clip });
        console.log(`${shot.repo}/docs/screenshots/${shot.name}.png`);
      } catch (error) {
        failures++;
        console.error(`FEHLER ${shot.repo}/${shot.name}: ${error.message.split('\n')[0]}`);
      }
    }
    await context.close();
  }
}

await browser.close();
process.exit(failures ? 1 : 0);
