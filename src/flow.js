'use strict';
// One Cohere account, end to end, inside an already-open browser context:
//   register (dashboard.cohere.com) -> email link -> confirm -> /api-keys
//   -> capture trial key (create additional named key if the trial one is not
//   readable) -> verify against api.cohere.com.
//
// Exports runAccount(cdp, sid, ctx) and the DOM/CDP helpers the CLIs share.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const lib = require('./lib');
const B = require('./browser');

const sleep = lib.sleep;
/** The dashboard sits behind a Vercel Security Checkpoint on some routes; a
 *  real browser clears it by itself. Wait it out instead of reading the DOM. */
async function passCheckpoint(cdp, sid, { timeoutMs = 75000, label = '' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let seen = false;
  while (Date.now() < deadline) {
    const st = await B.evalJs(cdp, sid, `({url: location.href, text: (document.body ? document.body.innerText : '').slice(0, 500)})`).catch(() => null);
    if (!st) return false;
    const isCp =
      /Vercel Security Checkpoint|verifying your browser|Enable JavaScript to continue|Just a moment|checking your browser|Verifying/i.test(st.text) ||
      /\/\.well-known\/vercel\/challenge|challenge/i.test(st.url);
    if (!isCp) {
      if (seen) lib.log('flow', `checkpoint cleared ${label} -> ${st.url}`);
      return true;
    }
    if (!seen) lib.log('flow', `checkpoint detected ${label} (${st.text.slice(0, 80).replace(/\n/g, ' ')}…)`);
    seen = true;
    await sleep(2500);
  }
  lib.log('flow', `checkpoint did not clear within ${timeoutMs}ms ${label}`);
  return false;
}

async function goto(cdp, sid, url, { timeoutMs = 90000, label = '' } = {}) {
  await B.navigate(cdp, sid, url, timeoutMs).catch(() => {});
  await passCheckpoint(cdp, sid, { label });
  await sleep(400);
}

const TAB = '\t';

// ------------------------------------------------------------------ CDP bits

function attachNet(cdp, sid) {
  const net = [];
  const byId = new Map();
  cdp.on(
    'Network.requestWillBeSent',
    (p) => {
      const rec = {
        id: p.requestId,
        method: p.request.method,
        url: p.request.url,
        type: p.type,
        postData: p.request.postData || null,
        headers: p.request.headers,
      };
      byId.set(p.requestId, rec);
      net.push(rec);
    },
    sid
  );
  cdp.on(
    'Network.responseReceived',
    (p) => {
      const rec = byId.get(p.requestId);
      if (rec) {
        rec.status = p.response.status;
        rec.mime = p.response.mimeType;
      }
    },
    sid
  );
  cdp.on(
    'Network.loadingFinished',
    async (p) => {
      const rec = byId.get(p.requestId);
      if (!rec) return;
      if (rec.status >= 400 || (rec.mime && /json/.test(rec.mime)) || /cohere|recaptcha/i.test(rec.url)) {
        try {
          const r = await cdp.send('Network.getResponseBody', { requestId: p.requestId }, sid);
          rec.body = (r.body || '').slice(0, 4000);
        } catch (e) {}
      }
    },
    sid
  );
  return net;
}

async function waitIn(cdp, sid, expr, { timeoutMs = 60000, everyMs = 1000, label = '' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await B.evalJs(cdp, sid, expr);
      if (last) return last;
    } catch (e) {
      last = { err: e.message };
    }
    await sleep(everyMs);
  }
  return null;
}

async function rectOf(cdp, sid, selector) {
  return B.evalJs(
    cdp,
    sid,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null;
      el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect();
      return {x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height}; })()`
  );
}

async function realClickAt(cdp, sid, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 }, sid);
  await sleep(60 + Math.random() * 80);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 }, sid);
  await sleep(40 + Math.random() * 60);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 }, sid);
}

async function realClickSelector(cdp, sid, selector) {
  const r = await rectOf(cdp, sid, selector);
  if (!r) return false;
  await realClickAt(cdp, sid, r.x, r.y);
  return true;
}

const CHAR_CODES = (ch) => {
  if (/[a-zA-Z]/.test(ch)) return { code: 'Key' + ch.toUpperCase(), key: ch };
  if (/[0-9]/.test(ch)) return { code: 'Digit' + ch, key: ch };
  if (ch === ' ') return { code: 'Space', key: ' ' };
  if (ch === '-') return { code: 'Minus', key: '-' };
  if (ch === '_') return { code: 'Minus', key: '_' };
  if (ch === '@') return { code: 'Digit2', key: '@' };
  if (ch === '.') return { code: 'Period', key: '.' };
  return { code: 'Unidentified', key: ch };
};

/** Focus a field with a real click, then type it character by character. */
async function realType(cdp, sid, selector, value) {
  if (!(await realClickSelector(cdp, sid, selector))) return false;
  await sleep(120);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 }, sid).catch(() => {});
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 }, sid).catch(() => {});
  for (const ch of value) {
    const { code, key } = CHAR_CODES(ch);
    await cdp
      .send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key, code }, sid)
      .catch(() => {});
    await sleep(15 + Math.random() * 45);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code }, sid).catch(() => {});
    await sleep(10 + Math.random() * 30);
  }
  return true;
}

/** Native-setter fill (React-safe) — fallback when typing is unnecessary. */
async function fillSel(cdp, sid, selector, value) {
  return B.evalJs(
    cdp,
    sid,
    `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.focus();
  return true;
})()`
  );
}

async function findByText(cdp, sid, patterns, sel = 'button, a, [role=button], [type=submit]') {
  const list = await B.evalJs(
    cdp,
    sid,
    `(() => {
  const pats = ${JSON.stringify(patterns)};
  const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
  for (const el of els) {
    const t = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
    if (!t) continue;
    for (const p of pats) if (new RegExp(p, 'i').test(t)) {
      const r = el.getBoundingClientRect();
      return {text: t.slice(0, 80), x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height};
    }
  }
  return null;
})()`
  );
  if (!list) return null;
  if (list.w < 2 || list.h < 2) {
    // hidden element: click via DOM as a fallback
    await B.evalJs(
      cdp,
      sid,
      `(() => { const els=[...document.querySelectorAll(${JSON.stringify(sel)})];
        const pats=${JSON.stringify(patterns)};
        for (const el of els) { const t=(el.innerText||el.textContent||'').trim();
          for (const p of pats) if (new RegExp(p,'i').test(t)) { el.click(); return true; } } return false; })()`
    );
    return { text: list.text, dom: true };
  }
  await realClickAt(cdp, sid, list.x, list.y);
  return list;
}

async function pageState(cdp, sid) {
  return B.evalJs(
    cdp,
    sid,
    `(() => ({
  url: location.href, title: document.title,
  text: document.body ? document.body.innerText.slice(0, 3000) : '',
  inputs: [...document.querySelectorAll('input, textarea')].map(i => ({tag:i.tagName, type:i.type||'', name:i.name||'', id:i.id||'',
    ph:i.placeholder||'', value:(i.value||'').slice(0,40)})).slice(0, 25),
  buttons: [...document.querySelectorAll('button, a, [role=button]')].slice(0, 50).map(b => (b.innerText||'').trim().slice(0,50)).filter(Boolean),
  captcha: {
    grecaptcha: typeof window.grecaptcha !== 'undefined',
    badge: !!document.querySelector('.grecaptcha-badge'),
    turnstile: !!document.querySelector('.cf-turnstile'),
    hcaptcha: !!document.querySelector('.h-captcha'),
  },
}))()`
  );
}

async function dump(cdp, sid, runDir, name) {
  const st = await pageState(cdp, sid).catch((e) => ({ err: e.message }));
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, `${name}.json`), JSON.stringify(st, null, 2));
  await B.screenshot(cdp, sid, path.join(runDir, `${name}.png`)).catch(() => {});
  lib.log('flow', `dump ${name}: url=${st.url} title=${st.title && st.title.slice(0, 60)} inputs=${st.inputs ? st.inputs.length : '?'} captcha=${JSON.stringify(st.captcha)}`);
  return st;
}

// ------------------------------------------------------------- key handling

const KEY_RE = /\b([A-Za-z0-9]{38,48})\b/g;

function looksLikeCohereKey(k) {
  return /^[A-Za-z0-9]{38,48}$/.test(k);
}

/** Reads every plausible key-looking string out of the API-keys DOM. */
async function scrapeKeys(cdp, sid) {
  const found = await B.evalJs(
    cdp,
    sid,
    `(() => {
  const texts = new Set();
  const push = (s) => { if (s && s.trim()) texts.add(s.trim()); };
  for (const el of document.querySelectorAll('code, input, td, span, div, pre')) {
    if (el.value) push(el.value);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') push(el.value);
    const t = el.childElementCount === 0 ? (el.textContent || '') : '';
    if (t && t.length < 120) push(t);
  }
  push((document.body && document.body.innerText || ''));
  return [...texts];
})()`
  );
  const keys = new Set();
  for (const t of found || []) {
    for (const m of String(t).matchAll(KEY_RE)) {
      const k = m[1];
      if (looksLikeCohereKey(k) && /[A-Za-z]/.test(k) && /[0-9]/.test(k)) keys.add(k);
    }
  }
  return [...keys];
}

// ------------------------------------------------------------------- verify

async function verifyKey(proxy, key, { tries = 3 } = {}) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const models = await lib.request(proxy, {
        url: 'https://api.cohere.com/v1/models?page_size=5',
        headers: { authorization: `bearer ${key}`, accept: 'application/json' },
        timeoutMs: 40000,
      });
      if (models.status === 401 || models.status === 403) {
        return { ok: false, reason: `models ${models.status}`, body: models.text.slice(0, 200) };
      }
      const chat = await lib.request(proxy, {
        method: 'POST',
        url: 'https://api.cohere.com/v1/chat',
        headers: { authorization: `bearer ${key}`, accept: 'application/json' },
        body: { model: 'command-a-03-2025', message: 'Say "ok" and nothing else.', max_tokens: 8 },
        timeoutMs: 60000,
      });
      const text = chat.json && chat.json.text ? chat.json.text : chat.text.slice(0, 200);
      return {
        ok: chat.status === 200,
        reason: `models=${models.status} chat=${chat.status}`,
        text,
        models: models.json && models.json.models ? models.json.models.map((m) => m.name).slice(0, 8) : null,
      };
    } catch (e) {
      last = e;
      await sleep(3000);
    }
  }
  return { ok: false, reason: `network: ${last && last.message}` };
}

// ----------------------------------------------------------------- the flow

/**
 * ctx = { index, address, token, mailPort, proxy (object), runDir, password,
 *         headless, proxyByPass }
 * Returns { ok, key, error, stage }.
 */
async function runAccount(cdp, sid, ctx) {
  const { runDir, address, token, mailPort, proxy } = ctx;
  const secret = ctx.password || makePassword();
  const net = attachNet(cdp, sid);
  const result = { ok: false, address, key: null, error: null, stage: 'start', password: secret };
  const save = () => fs.writeFileSync(path.join(runDir, 'net.json'), JSON.stringify(net, null, 2));
  try {
    // ---- warm-up: land on the dashboard's own login page first (cheap, and it
    // sets the origin cookies), exactly like a human who followed a link
    result.stage = 'warm';
    await goto(cdp, sid, 'https://dashboard.cohere.com/welcome/login', { label: 'warm' });
    await sleep(1200 + Math.random() * 1200);
    await realClickAt(cdp, sid, 600, 400).catch(() => {});
    await sleep(300);

    // ---- register
    result.stage = 'register';
    await goto(cdp, sid, `https://dashboard.cohere.com/welcome/register?email=${encodeURIComponent(address)}`, { label: 'register' });
    const formReady = await waitIn(cdp, sid, `!!document.querySelector('input[name=email], input[type=email]')`, {
      timeoutMs: 45000,
      label: 'register form',
    });
    await dump(cdp, sid, runDir, '1-register');
    if (!formReady) throw new Error('register form never appeared');

    // email: pre-filled via query, but type/verify anyway
    await fillSel(cdp, sid, 'input[name=email], input[type=email]', address);
    await sleep(300);
    await realType(cdp, sid, 'input[name=password], input[type=password]', secret);
    await sleep(400);
    await dump(cdp, sid, runDir, '2-filled');

    // consent checkbox if present
    await B.evalJs(
      cdp,
      sid,
      `(() => { const cb = document.querySelector('input[type=checkbox]'); if (cb && !cb.checked) { cb.click(); return true; } return false; })()`
    ).catch(() => {});

    // The button stays disabled until the password-strength chunk (lazy 22044)
    // loads and rates the password >= 3. Give it time; report what it says.
    const gate = await waitIn(
      cdp,
      sid,
      `(() => {
        const btns = [...document.querySelectorAll('button[type=submit], button')];
        const b = btns.find(x => /sign up|create account|sign me up/i.test((x.innerText||'').trim()));
        if (!b) return null;
        const detail = (document.body.innerText.match(/weak|strong|strength|at least|must contain[^\\n]{0,60}/i) || [])[0] || '';
        return {disabled: !!b.disabled, detail, label: (b.innerText||'').trim().slice(0,40)};
      })()`,
      { timeoutMs: 40000, everyMs: 1500, label: 'submit-enabled' }
    );
    const submitState = await B.evalJs(
      cdp,
      sid,
      `(() => { const b = [...document.querySelectorAll('button')].find(x => /sign up|create account/i.test((x.innerText||'').trim()));
        return b ? {disabled: !!b.disabled} : null; })()`
    ).catch(() => null);
    lib.log('flow', `submit gate: ${JSON.stringify(submitState)} (meter detail ${JSON.stringify(gate && gate.detail)})`);
    const preSubmit = await dump(cdp, sid, runDir, '2b-gate');

    let clicked = null;
    if (submitState && !submitState.disabled) {
      clicked = await findByText(cdp, sid, ['create account', 'sign up', 'sign me up', 'continue with email', 'register', 'get started']);
      if (!clicked) clicked = await realClickSelector(cdp, sid, 'button[type=submit], input[type=submit]');
      lib.log('flow', `submit click: ${JSON.stringify(clicked)}`);
    }
    if (!clicked) {
      // Meter or chunk never arrived: trigger react-hook-form's onSubmit directly.
      const synth = await B.evalJs(
        cdp,
        sid,
        `(() => { const f = document.querySelector('form'); if (!f) return false;
          f.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})); return true; })()`
      );
      lib.log('flow', `submit via synthetic submit event: ${synth}`);
    }
    await sleep(2500);

    // wait for either a fresh error message or the confirm page
    const baseline = String((preSubmit && preSubmit.text) || '').toLowerCase();
    const deadline = Date.now() + 45000;
    let after = null;
    while (Date.now() < deadline) {
      const st = await pageState(cdp, sid).catch(() => null);
      if (!st) break;
      const t = String(st.text || '');
      if (/check your|verify your|confirm|you will receive|email confirmation|welcome to cohere/i.test(t)) {
        after = { url: st.url, done: true };
        break;
      }
      const m = t.toLowerCase().match(/(invalid|already exists|incorrect|weak|captcha|too many|try again|not allowed|blocked)[^\n]{0,120}/);
      if (m && !baseline.includes(m[0]) && !/weak|strength/i.test(m[0])) {
        after = { url: st.url, err: m[0] };
        break;
      }
      await sleep(1500);
    }
    lib.log('flow', `post-submit: ${JSON.stringify(after)}`);
    await dump(cdp, sid, runDir, '3-postsubmit');
    if (after && after.err) {
      result.error = `register rejected: ${after.err}`;
      result.stage = 'register-rejected';
      save();
      return result;
    }

    // ---- email link
    result.stage = 'mail';
    const mail = await lib.waitForMail(mailPort, token, /https?:\/\/[^\s"'<>)]*(confirm|verify|activate|token|welcome)[^\s"'<>)]*/i, {
      timeoutMs: 240000,
      pollMs: 5000,
    });
    await dump(cdp, sid, runDir, '4-waitmail');
    if (!mail) {
      result.error = 'no verification mail within 240s';
      save();
      return result;
    }
    let link = (mail.text + '\n' + mail.html).match(/https?:\/\/[^\s"'<>)\]]+/g).find((u) => /confirm|verify|activate|token/i.test(u)) || mail.match[0];
    link = link.replace(/&amp;/g, '&').replace(/[)\].,]+$/, '');
    fs.writeFileSync(path.join(runDir, 'mail.json'), JSON.stringify({ subject: mail.subject, link }, null, 2));
    lib.log('flow', `mail "${mail.subject}" link=${link.slice(0, 140)}`);

    result.stage = 'confirm';
    await goto(cdp, sid, link, { label: 'confirm-link' });
    await sleep(3500);
    await dump(cdp, sid, runDir, '5-after-confirm');

    // ---- dashboard / login fallback
    const loggedIn = await waitIn(
      cdp,
      sid,
      `(() => { const u = location.href; const t = document.body ? document.body.innerText : '';
        if (/api-keys|dashboard\\.cohere\\.com\\/(?!welcome)/.test(u) && !/welcome\\/login/.test(u)) return u;
        return null; })()`,
      { timeoutMs: 30000, everyMs: 1500, label: 'logged-in' }
    );

    if (!loggedIn || /welcome\/login/.test(loggedIn)) {
      result.stage = 'login';
      await goto(cdp, sid, 'https://dashboard.cohere.com/welcome/login', { label: 'login' });
      await waitIn(cdp, sid, `!!document.querySelector('input[name=email], input[type=email]')`, { timeoutMs: 40000 });
      await fillSel(cdp, sid, 'input[name=email], input[type=email]', address);
      await sleep(400);
      await realType(cdp, sid, 'input[name=password], input[type=password]', secret);
      await sleep(500);
      await findByText(cdp, sid, ['sign in', 'log in', 'login', 'continue']);
      await sleep(4000);
      await dump(cdp, sid, runDir, '6-after-login');
    }

    // ---- api keys page
    result.stage = 'api-keys';
    await goto(cdp, sid, 'https://dashboard.cohere.com/api-keys', { label: 'api-keys' });
    await sleep(3500);
    const keysPage = await dump(cdp, sid, runDir, '7-apikeys');
    let keys = await scrapeKeys(cdp, sid);

    if (!keys.length) {
      // maybe the trial key hides behind a reveal control or an extra page step
      await findByText(cdp, sid, ['reveal', 'show', 'copy', 'api keys']).catch(() => {});
      await sleep(2000);
      keys = await scrapeKeys(cdp, sid);
    }

    if (!keys.length) {
      // create a named key: input appears in a modal/panel
      result.stage = 'create-key';
      const opened = await findByText(cdp, sid, ['create api key', 'create an api key', 'new api key', 'create key', 'new key']);
      lib.log('flow', `create-key dialog: ${JSON.stringify(opened)}`);
      await sleep(2000);
      await dump(cdp, sid, runDir, '8-createkey');
      const nameInput = await B.evalJs(
        cdp,
        sid,
        `(() => { const i = [...document.querySelectorAll('input, textarea')].find(x => /name|key/i.test((x.placeholder||'') + (x.name||'') + (x.id||'')));
          return i ? {id: i.id||'', name: i.name||'', ph: i.placeholder||''} : null; })()`
      );
      lib.log('flow', `name input: ${JSON.stringify(nameInput)}`);
      if (nameInput) {
        const sel = nameInput.id ? `#${nameInput.id}` : nameInput.name ? `input[name="${nameInput.name}"]` : 'input[placeholder*="ame"]';
        await realType(cdp, sid, sel, 'default');
        await sleep(500);
        await findByText(cdp, sid, ['create', 'submit', 'generate', 'save', 'add']);
        await sleep(3000);
        await dump(cdp, sid, runDir, '9-keycreated');
        keys = await scrapeKeys(cdp, sid);
      }
    }

    save();
    if (!keys.length) {
      result.error = `no key found on api-keys page (url=${keysPage.url})`;
      return result;
    }

    // ---- verify every candidate until one lives
    result.stage = 'verify';
    for (const k of keys) {
      const v = await verifyKey(proxy, k);
      fs.appendFileSync(path.join(runDir, 'verify.log'), `${k.slice(0, 6)}…${k.slice(-4)} ${JSON.stringify(v).slice(0, 300)}\n`);
      if (v.ok) {
        result.ok = true;
        result.key = k;
        result.verify = v;
        break;
      }
    }
    if (!result.ok) {
      result.error = `no candidate key verified (${keys.length} tried)`;
      // A key the page showed but the live check could not confirm is still the
      // only copy of that credential — hand it to the caller instead of dropping it.
      result.unverifiedKey = keys[0];
    }
    return result;
  } catch (e) {
    result.error = `${result.stage}: ${e.message}`;
    try {
      save();
    } catch (err) {}
    return result;
  } finally {
    try {
      fs.writeFileSync(path.join(runDir, 'net-final.json'), JSON.stringify(net, null, 2));
    } catch (e) {}
  }
}

function makePassword() {
  // The register form disables its button until a client-side strength meter
  // (minValidScore 3, zxcvbn-style) accepts both password and email, so the
  // password must be long, mixed-class and dictionary-free.
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const syms = '!@#%^&*-_';
  const pick = (s) => s[crypto.randomInt(s.length)]; // not Math.random: these are account credentials
  const rnd = (n) => Array.from({ length: n }, () => pick(lower + upper + digits)).join('');
  return pick(upper) + rnd(6) + pick(syms) + pick(digits) + rnd(7) + pick(syms) + pick(upper);
}

module.exports = {
  runAccount,
  goto,
  passCheckpoint,
  verifyKey,
  scrapeKeys,
  dump,
  waitIn,
  attachNet,
  realClickAt,
  realClickSelector,
  realType,
  fillSel,
  findByText,
  pageState,
  makePassword,
};
