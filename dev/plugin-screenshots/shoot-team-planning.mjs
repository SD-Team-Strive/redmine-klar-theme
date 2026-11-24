// Screenshots und kurzes Video von Team Planning (Theme Klar, erfundene Daten)
// nach redmine-team-planning/docs/screenshots/ (*.png, demo.mp4, demo.gif)
// Aufruf über dev/plugin-screenshots/run.sh (erwartet die Instanz auf :3091
// mit setup-team-planning.rb)

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.REDMINE_URL ?? 'http://localhost:3091';
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../redmine-team-planning/docs/screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium', args: ['--lang=de-DE'] });
let failures = 0;

async function login(page) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin');
  await page.click('#login-submit');
}

async function settle(page) {
  await page.waitForTimeout(500);
  await page.evaluate(() => document.activeElement?.blur());
}

async function shoot(page, name, options = {}) {
  try {
    await page.screenshot({ path: join(outDir, `${name}.png`), ...options });
    console.log(`redmine-team-planning/docs/screenshots/${name}.png`);
  } catch (error) {
    failures++;
    console.error(`FEHLER ${name}: ${error.message.split('\n')[0]}`);
  }
}

async function elementClip(page, selector, pad = 16, padBottom = 0) {
  const box = await page.locator(selector).first().boundingBox();
  return { x: Math.max(box.x - pad, 0), y: Math.max(box.y - pad, 0), width: box.width + 2 * pad, height: box.height + 2 * pad + padBottom };
}

// --- Screenshots ---------------------------------------------------------------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
  const page = await context.newPage();
  await login(page);

  await page.goto(`${baseUrl}/team_planning`);
  await settle(page);
  await shoot(page, 'board');

  // Abhaken mit Abschluss-Aktionen
  const card = '.tp-col.is-current .tp-cards .tp-card:not(.is-done) [data-tp-check]';
  await page.locator(card).first().click();
  await page.waitForSelector('.tp-pop .tp-done-option');
  await page.waitForTimeout(300);
  await shoot(page, 'done-actions', { clip: await elementClip(page, '.tp-pop', 120, 40) });
  await page.keyboard.press('Escape');

  // Pool
  await page.click('[data-tp-backlog=pool]');
  await page.waitForTimeout(400);
  await shoot(page, 'pool', { clip: await elementClip(page, '.tp-col.is-backlog', 0) });

  // Abgeschlossener Zeitraum: Detailseite und Übersicht
  await page.goto(`${baseUrl}/team_planning/periods`);
  await settle(page);
  const lastPeriod = await page.locator('a.tp-period-link').first().getAttribute('href');
  await shoot(page, 'periods', { fullPage: true });
  await page.goto(`${baseUrl}${lastPeriod}`);
  await settle(page);
  await shoot(page, 'period', { fullPage: true });

  await page.goto(`${baseUrl}/team_planning/close`);
  await settle(page);
  await shoot(page, 'close', { fullPage: true });

  await page.goto(`${baseUrl}/team_planning/team`);
  await settle(page);
  await shoot(page, 'team', { fullPage: true });

  await page.goto(`${baseUrl}/team_planning/team?mode=project`);
  await settle(page);
  await shoot(page, 'team-by-project', { fullPage: true });

  await page.goto(`${baseUrl}/my/page`);
  await settle(page);
  // Zusatzzeile (Kommentar, Tätigkeit, Tag) nur bei Bedarf, nicht im Bild
  await page.evaluate(() => document.querySelectorAll('.tp-wmore').forEach((e) => { e.hidden = true; }));
  await shoot(page, 'my-page-block', { clip: await elementClip(page, '#block-team_plan') });

  await page.goto(`${baseUrl}/settings/plugin/redmine_team_planning`);
  await settle(page);
  await shoot(page, 'settings', { fullPage: true });
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const phone = await mobile.newPage();
  await login(phone);
  await phone.goto(`${baseUrl}/my/page`);
  await settle(phone);
  await shoot(phone, 'mobile-my-page');
  await phone.goto(`${baseUrl}/team_planning`);
  await settle(phone);
  await shoot(phone, 'mobile-board');
  await mobile.close();
}

// --- Video ---------------------------------------------------------------------
// Playwright zeichnet keinen Mauszeiger auf, darum ein eingeblendeter Zeiger
const cursorScript = () => {
  window.addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;z-index:2147483647;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;'
      + 'background:rgba(17,24,39,.35);border:2px solid rgba(17,24,39,.85);pointer-events:none;transition:transform .1s;left:-50px;top:-50px';
    document.body.appendChild(dot);
    const at = (e) => { dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`; };
    window.addEventListener('pointermove', at, true);
    window.addEventListener('pointerdown', (e) => { at(e); dot.style.transform = 'scale(.7)'; }, true);
    window.addEventListener('pointerup', () => { dot.style.transform = ''; }, true);
  });
};

{
  const videoDir = mkdtempSync(join(tmpdir(), 'tp-video-'));
  const size = { width: 1280, height: 800 };
  const context = await browser.newContext({ viewport: size, locale: 'de-DE', recordVideo: { dir: videoDir, size } });
  await context.addInitScript(cursorScript);
  const page = await context.newPage();
  const pause = (ms = 900) => page.waitForTimeout(ms);
  const moveTo = async (selector, dx = 0.5, dy = 0.5) => {
    // Listen scrollen in sich: Ziel erst sichtbar machen, sonst liegt der Punkt woanders
    await page.locator(selector).first().scrollIntoViewIfNeeded();
    const box = await page.locator(selector).first().boundingBox();
    await page.mouse.move(box.x + box.width * dx, box.y + box.height * dy, { steps: 18 });
    return box;
  };
  const clickOn = async (selector) => {
    await moveTo(selector);
    await pause(250);
    await page.locator(selector).first().click();
  };
  const drag = async (from, to) => {
    await moveTo(from, 0.3, 0.3);
    await page.mouse.down();
    await page.mouse.move((await page.locator(from).first().boundingBox()).x + 60, (await page.locator(from).first().boundingBox()).y + 30, { steps: 5 });
    await moveTo(to, 0.5, 0.85);
    await pause(300);
    await page.mouse.up();
  };

  try {
    await login(page);
    await page.goto(`${baseUrl}/team_planning`);
    await settle(page);
    await page.mouse.move(640, 400);
    await pause(1500);

    // 1. Aus dem Backlog in die laufende Woche ziehen
    const current = '.tp-col.is-current > .tp-cards';
    await drag('.tp-cards[data-location=backlog] .tp-card', current);
    await pause(1800);

    // 2. In die nächste Woche schieben
    await drag(`${current} .tp-card[data-location^="20"]:not(.is-done)`, '.tp-col.is-current + .tp-col > .tp-cards');
    await pause(1600);

    // 3. Stunden planen
    await clickOn(`${current} .tp-card[data-location^="20"] [data-tp-hours]`);
    await pause(700);
    const hoursInput = page.locator('.tp-pop input').first();
    if (await hoursInput.count()) {
      await hoursInput.pressSequentially('3', { delay: 150 });
      await pause(300);
      await page.keyboard.press('Enter');
    }
    await pause(1500);

    // 4. Abhaken mit Abschluss-Aktion
    await clickOn(`${current} .tp-card[data-location^="20"]:not(.is-done) [data-tp-check]`);
    await page.waitForSelector('.tp-pop .tp-done-option');
    await pause(1500);
    await clickOn('.tp-pop .tp-done-option');
    await pause(2200);

    // 5. Meine Seite: Zeit buchen
    await page.goto(`${baseUrl}/my/page`);
    await settle(page);
    await pause(1200);
    await clickOn('#block-team_plan .tp-wrow:has([data-tp-check]:not([aria-pressed=true])) [data-hours="1"]');
    await page.waitForLoadState();
    await pause(2200);

    // 6. Teamrunde
    await page.goto(`${baseUrl}/team_planning/team`);
    await settle(page);
    await pause(1500);
    await page.mouse.wheel(0, 500);
    await pause(1500);
    await page.goto(`${baseUrl}/team_planning/team?mode=project`);
    await settle(page);
    await pause(2200);
  } catch (error) {
    failures++;
    console.error(`FEHLER Video: ${error.message.split('\n')[0]}`);
  }
  await context.close();

  const raw = join(videoDir, readdirSync(videoDir).find((f) => f.endsWith('.webm')));
  const mp4 = join(outDir, 'demo.mp4');
  const gif = join(outDir, 'demo.gif');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1',
    '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'medium', '-an', '-movflags', '+faststart', mp4]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-vf',
    'fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    gif]);
  rmSync(videoDir, { recursive: true, force: true });
  console.log('redmine-team-planning/docs/screenshots/demo.mp4, demo.gif');
}

await browser.close();
process.exit(failures ? 1 : 0);
