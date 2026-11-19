// Screenshots der wichtigsten Redmine-Seiten für den Theme-Vergleich.
// Aufruf: npm run screenshots [-- <filter>] [--mobile]
// Ergebnis: dev/screenshots/<viewport>/<name>.png
//
// Optionen je Seite:
//   anonymous  ohne Anmeldung
//   action     vor dem Screenshot ausführen (Klick o. ä.)
//   after      danach ausführen (Zustand zurücksetzen)
//   only       'desktop' oder 'mobile', wenn die Aktion nur dort existiert

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.env.REDMINE_URL ?? 'http://localhost:3080';
const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const filter = args.find((arg) => !arg.startsWith('--'));
const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const outDir = `dev/screenshots/${mobile ? 'mobile' : 'desktop'}`;

const pages = [
  ['login', '/login', { anonymous: true }],
  ['home', '/'],
  ['projects', '/projects'],
  ['project-overview', '/projects/website-relaunch'],
  ['issues', '/projects/website-relaunch/issues'],
  ['issues-priorities', '/projects/website-relaunch/issues?set_filter=1&sort=priority:desc,id:desc'],
  ['issue', '/issues/1'],
  ['issue-16', '/issues/16'],
  ['issue-sidebar-collapsed', '/issues/1', {
    only: 'desktop',
    action: async (page) => page.click('#sidebar-switch-button'),
    after: async (page) => page.click('#sidebar-switch-button'),
  }],
  ['issue-edit', '/issues/1', { action: async (page) => page.click('a.icon-edit >> nth=0') }],
  ['issue-new', '/projects/website-relaunch/issues/new'],
  ['issue-context-menu', '/projects/website-relaunch/issues', {
    only: 'desktop',
    action: async (page) => page.click('tr.issue >> nth=1', { button: 'right' }),
  }],
  ['activity', '/projects/website-relaunch/activity'],
  ['activity-global', '/activity'],
  ['roadmap', '/projects/website-relaunch/roadmap'],
  ['version', '/versions/1'],
  ['gantt', '/projects/website-relaunch/issues/gantt'],
  ['calendar', '/projects/website-relaunch/issues/calendar'],
  ['time-entries', '/projects/website-relaunch/time_entries'],
  ['time-report', '/projects/website-relaunch/time_entries/report?criteria[]=user&columns=month'],
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
  ['admin-roles', '/roles/permissions'],
  ['search', '/search?q=header'],
  ['account-menu', '/projects', {
    only: 'desktop',
    action: async (page) => page.click('#account .dropdown-trigger'),
  }],
  ['flyout-menu', '/projects/website-relaunch/issues', {
    only: 'mobile',
    action: async (page) => page.click('.mobile-toggle-button'),
  }],
  ['flash-error', '/projects/website-relaunch/issues/new', {
    action: async (page) => page.click('input[name="commit"]'),
  }],
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'de-DE' });
const page = await context.newPage();
let failures = 0;

async function login() {
  await page.goto(`${baseUrl}/login`);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin');
  await page.click('#login-submit');
}

for (const [name, path, options = {}] of pages) {
  if (filter && !name.includes(filter)) continue;
  if (options.only && options.only !== (mobile ? 'mobile' : 'desktop')) continue;

  try {
    if (options.anonymous) {
      await context.clearCookies();
    } else if (!(await context.cookies()).some((c) => c.name === '_redmine_session') || page.url().includes('/login')) {
      await login();
    }
    await page.goto(`${baseUrl}${path}`);
    if (options.action) {
      await options.action(page);
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
    console.log(`${outDir}/${name}.png`);
    if (options.after) {
      await options.after(page);
      await page.waitForTimeout(200);
    }
  } catch (error) {
    failures++;
    console.error(`FEHLER ${name}: ${error.message.split('\n')[0]}`);
  }

  if (options.anonymous) await login();
}

await browser.close();
process.exit(failures ? 1 : 0);
