// Shared Playwright helpers for drivers: `import { open } from '<skill>/scripts/pw.mjs'`.
// Logs in by injecting the fleetctl token as the UI's auth cookie, so no password is ever typed.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
// Playwright comes from this repo's suite (<repo>/playwright), four levels up from
// .claude/skills/fleet-bug-qa/scripts/. PW_DIR points it at another install.
const suiteDir = fileURLToPath(new URL('../../../../playwright/', import.meta.url));
const require = createRequire((process.env.PW_DIR || suiteDir).replace(/\/?$/, '/'));
export const { chromium } = require('playwright');

export function ctxInfo(ctx) {
  const cfg = fs.readFileSync(os.homedir() + '/.fleet/config', 'utf8').split('\n');
  let inCtx = false, address, token;
  for (const line of cfg) {
    if (/^  \S/.test(line)) inCtx = line.trim() === ctx + ':';
    else if (inCtx) {
      const m = line.match(/^\s+(address|token):\s*(\S+)/);
      if (m) m[1] === 'address' ? (address = m[2]) : (token = m[2]);
    }
  }
  if (!address) throw new Error(`context ${ctx} not found in ~/.fleet/config`);
  return { address: address.replace(/\/$/, ''), token };
}

// opts: token (log in as another user), anon (no auth cookie), cookies ({name: value}),
// width/height. Reduced motion avoids capturing pages mid fade-in.
export async function open(ctx, opts = {}) {
  const { address, token } = ctxInfo(ctx);
  const u = new URL(address);
  const secure = u.protocol === 'https:';
  const browser = await chromium.launch({ headless: !opts.headed });
  const context = await browser.newContext({
    viewport: { width: opts.width || 1440, height: opts.height || 900 },
    ignoreHTTPSErrors: true, reducedMotion: 'reduce',
  });
  const cookies = [];
  // frontend/utilities/auth_token.ts: __Host-token over https, token over http
  if (!opts.anon) cookies.push({ name: secure ? '__Host-token' : 'token', value: opts.token || token, url: u.origin + '/', secure, sameSite: 'Lax' });
  for (const [name, value] of Object.entries(opts.cookies || {})) cookies.push({ name, value, url: u.origin + '/', secure, sameSite: 'Lax' });
  await context.addCookies(cookies);
  const page = await context.newPage();
  const url = (p) => (/^https?:/.test(p) ? p : u.origin + (p.startsWith('/') ? p : '/' + p));
  return { browser, context, page, address, url };
}
