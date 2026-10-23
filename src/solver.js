'use strict';

/**
 * src/solver.js — the repo's captcha engine and the `--auto` entry.
 *
 * cohere's register gate is Google reCAPTCHA **Enterprise**: the dashboard
 * injects `enterprise.js?render=<sitekey>` and calls
 * `grecaptcha.enterprise.execute(sitekey, { action })`. A token is only good for
 * the origin that minted it and the exit it left through, so the browser path is
 * the path this repo uses — there is no HTTP-only shortcut here.
 *
 * `pageEval` and `recaptchaToken` are moved verbatim from light.js: the mint flow
 * calls them on the page it already holds. `solveCaptcha` is the one-command
 * entry — it opens its own page (and, when no Chrome is listening, launches one
 * through src/browser.js) so the mint path has nothing to decide.
 *
 * Locked one-command entry:
 *   const { solveCaptcha } = require('./solver.js');
 *   const { token, ms } = await solveCaptcha({ type, sitekey, url, proxy, action });
 */

const B = require('./browser');
const flow = require('./flow');
const recaptcha = require('./recaptcha-cache');

const RECAPTCHA_KEY = '6LfwwhgpAAAAAJiItLCXBrm2UJpZe9xzFkaiXFiA';
const REGISTER_URL = 'https://dashboard.cohere.com/welcome/register';

/** The one page-global namespace this module owns. */
const NS = '__chRecap';

/** Runs an expression in-page; Promise results are awaited. */
function pageEval(cdp, sid, expr, opts = {}) {
  return B.evalJs(cdp, sid, expr, { awaitPromise: true, ...opts });
}

/** Injects Google's reCAPTCHA Enterprise script into the page and returns a token. */
async function recaptchaToken(cdp, sid, action, { timeoutMs = 120000, log = () => {} } = {}) {
  await pageEval(
    cdp,
    sid,
    `(() => {
      if (window.${NS}Injected) return 'already';
      window.${NS}Injected = true;
      const s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_KEY}&hl=en';
      s.async = true;
      document.head.appendChild(s);
      return 'injected';
    })()`
  );
  const ready = await flow.waitIn(
    cdp,
    sid,
    `(
      typeof window.grecaptcha !== 'undefined' &&
      window.grecaptcha.enterprise && typeof window.grecaptcha.enterprise.execute === 'function' &&
      window.${NS}Ready ? 'ready' : (function(){ if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha.enterprise && window.grecaptcha.enterprise.ready) { window.grecaptcha.enterprise.ready(function(){ window.${NS}Ready = true; }); } return null; })()
    )`,
    { timeoutMs, everyMs: 1000, label: 'grecaptcha-enterprise' }
  );
  if (!ready) throw new Error('reCAPTCHA enterprise never became ready (google unreachable through this exit?)');
  log(`  solver: enterprise ready, executing action=${action}`);
  const tok = await pageEval(
    cdp,
    sid,
    `new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('execute timeout')), 60000);
      try {
        grecaptcha.enterprise.execute(${JSON.stringify(RECAPTCHA_KEY)}, { action: ${JSON.stringify(action)} })
          .then((v) => { clearTimeout(t); resolve(v); })
          .catch((e) => { clearTimeout(t); reject(e); });
      } catch (e) { clearTimeout(t); reject(e); }
    })`
  );
  return tok;
}

/**
 * One reCAPTCHA Enterprise token, following the shared solver contract:
 *
 *   const { token, ms } = await solveCaptcha({ type, sitekey, url, proxy, action });
 *
 * `proxy` is the page's exit (`'http://user:pass@host:port'` / `'socks5://host:port'`)
 * or null for DIRECT — the smartcard has to leave through the exit that spends it.
 * Pass `{ cdp, sid }` to mint on a page the caller already holds (the mint flow
 * does exactly that); without them this opens its own page, launching Chrome on
 * `port` when nothing is listening. Resolves with the untrimmed token, or throws.
 */
async function solveCaptcha({
  type = 'recaptcha-enterprise',
  sitekey = RECAPTCHA_KEY,
  url = REGISTER_URL,
  proxy = null,
  action = 'register',
  cdp = null,
  sid = null,
  headless = false,
  port = Number(process.env.COHERE_CDP_PORT || 9222),
  log = () => {},
} = {}) {
  if (type !== 'recaptcha-enterprise') {
    throw new Error(`solveCaptcha: unsupported captcha type "${type}" (cohere registers behind reCAPTCHA Enterprise)`);
  }
  const t0 = Date.now();
  let browser = cdp;
  let page = sid;
  let own = null;
  if (!browser || !page) {
    browser = await B.connect(port).catch(async () => {
      log(`  solver: no Chrome on :${port} — launching one`);
      B.launchChrome(port, 'solver', { headless });
      return B.connect(port);
    });
    own = await B.openContext(browser, { proxyServer: proxy ? String(proxy) : undefined, url: 'about:blank' });
    page = own.sessionId;
  }
  try {
    // The enterprise runtime is cached locally because the Google hosts are not
    // always reachable from a free exit; the page works without the cache too.
    await recaptcha.install(browser, page, { log }).catch((e) => log(`  solver: recaptcha cache skipped (${e.message})`));
    if (own) await B.navigate(browser, page, url);
    const token = await recaptchaToken(browser, page, action, { log });
    if (!token) throw new Error('solveCaptcha: reCAPTCHA Enterprise returned no token');
    return { token, ms: Date.now() - t0 };
  } finally {
    if (own) {
      await browser.send('Target.closeTarget', { targetId: own.targetId }, null).catch(() => null);
      if (own.browserContextId) {
        await browser.send('Target.disposeBrowserContext', { browserContextId: own.browserContextId }, null).catch(() => null);
      }
    }
  }
}

module.exports = { solveCaptcha, recaptchaToken, pageEval, RECAPTCHA_KEY, REGISTER_URL, NS };
