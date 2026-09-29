// usage: node screenshot.mjs <ctx> <path-or-url> <out.png> [options]
//   --full                 full-page capture (can wash out on some pages; prefer --clip)
//   --clip "<selector>"    capture just this element
//   --click "<text>"       click an element by visible text before capture (repeatable, in order)
//   --focus "<selector>"   focus an element (e.g. a searchable dropdown input) before capture
//   --type "<text>"        type into the focused element
//   --wait "<selector>"    wait for an element before capture
//   --cookie NAME=VALUE    set an extra cookie (repeatable) — for cookie/session bugs
//   --token <tok>          view as another user (e.g. an API-only test user)
//   --anon                 no Fleet login (unauthenticated pages)
//   --caret                keep the text caret visible (Playwright hides it by default)
//   --width/--height/--delay ms
import { open } from './pw.mjs';

const [ctx, target, out, ...rest] = process.argv.slice(2);
if (!ctx || !target || !out) { console.error('usage: screenshot.mjs <ctx> <path-or-url> <out.png> [options]'); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const cookies = {};
rest.forEach((a, i) => { if (a === '--cookie') { const [k, ...v] = rest[i + 1].split('='); cookies[k] = v.join('='); } });

const { browser, page, url } = await open(ctx, {
  token: opt('--token'), anon: rest.includes('--anon'), cookies,
  width: +opt('--width', 1440), height: +opt('--height', 900),
});
await page.goto(url(target), { waitUntil: 'load', timeout: 60000 });
// Pages that poll (dashboard, host details) may never go network-idle; don't fail on it.
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
if (!rest.includes('--anon') && !Object.keys(cookies).length && page.url().includes('/login')) {
  console.error('ended on /login — token rejected or expired'); await browser.close(); process.exit(1);
}
await page.waitForTimeout(1500);
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--click') { await page.getByText(rest[++i], { exact: false }).first().click(); await page.waitForTimeout(1500); }
  else if (rest[i] === '--focus') { await page.locator(rest[++i]).first().focus(); await page.waitForTimeout(500); }
  else if (rest[i] === '--type') { await page.keyboard.type(rest[++i]); await page.waitForTimeout(800); }
}
const wait = opt('--wait');
if (wait) await page.locator(wait).first().waitFor({ timeout: 30000 });
await page.waitForTimeout(+opt('--delay', 500));
const shotOpts = { path: out, caret: rest.includes('--caret') ? 'initial' : 'hide', animations: 'disabled' };
const clip = opt('--clip');
if (clip) { const el = page.locator(clip).first(); await el.scrollIntoViewIfNeeded(); await el.screenshot(shotOpts); }
else await page.screenshot({ ...shotOpts, fullPage: rest.includes('--full') });
console.log(out, '<-', page.url());
await browser.close();
