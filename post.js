'use strict';
// Everything after the register POST, done from Node through the proxy pool:
// confirm the email link, obtain a bearer token, pull the trial API key.
// The browser is not involved, so a dead exit mid-flow costs one retry here
// instead of the whole account.

const fs = require('fs');
const https = require('https');
const path = require('path');
const lib = require('./lib');
const rpc = require('./rpc');
const flow = require('./flow');

/** Pulls plausible confirm tokens out of an email link. */
function tokensFromLink(link) {
  const out = {};
  try {
    const u = new URL(link);
    for (const [k, v] of u.searchParams) out[k] = v;
    const tail = u.pathname.split('/').filter(Boolean);
    if (tail.length) out.__last = tail[tail.length - 1];
  } catch (e) {}
  const flat = link.match(/[?&]([A-Za-z_]+)=([^&#]+)/g) || [];
  for (const pair of flat) {
    const [k, v] = pair.slice(1).split('=');
    if (!(k in out)) out[k] = decodeURIComponent(v);
  }
  return out;
}

/**
 * Cohere's mail wraps every link in SendGrid click-tracking
 * (`u18777040.ct.sendgrid.net/ls/click?upn=…`); the real
 * `dashboard.cohere.com/confirm-email?token=…` target only appears in the
 * redirect Location. A no-follow GET (direct first — sendgrid answers our
 * line — then through an exit) reads the Location without consuming anything.
 */
function noFollowGet(url, { proxy, timeoutMs = 20000 } = {}) {
  if (proxy) {
    return lib
      .request(proxy, { url, timeoutMs, headers: { accept: 'text/html', 'user-agent': lib.UA } })
      .then((r) => ({ status: r.status, location: r.headers && r.headers.location }));
  }
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method: 'GET',
        host: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        family: 4,
        timeout: timeoutMs,
        headers: { 'user-agent': lib.UA, accept: 'text/html' },
      },
      (res) => {
        const location = res.headers.location || null;
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode, location }));
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end();
  });
}

/** True when `loc` looks like the real confirmation target. */
function isConfirmLoc(loc) {
  return /dashboard\.cohere\.com\/confirm-email/i.test(loc) || (/cohere\.(com|ai)/i.test(loc) && /(confirm|verify|activate)/i.test(loc) && !/assets\./i.test(loc));
}

async function resolveTracking(urls, { log = () => {}, limit = 20 } = {}) {
  let fallback = null;
  const clean = (loc) => (loc ? loc.replace(/&amp;/g, '&').replace(/["')\s]+$/, '') : null);
  const consider = (from, loc, tag = '') => {
    if (!loc) return false;
    if (isConfirmLoc(loc)) {
      log(`resolved${tag} ${from.slice(0, 70)}… -> ${loc.slice(0, 140)}`);
      return true;
    }
    if (!fallback && /cohere\.(com|ai)/i.test(loc) && !/assets\.|\.(woff2?|png|jpe?g|css|js|ico)/i.test(loc) && !/^https?:\/\/(www\.)?cohere\.(com|ai)\/?$/i.test(loc)) fallback = loc;
    return false;
  };
  for (const u of urls.slice(0, limit)) {
    if (!/sendgrid\.net|mailgun|mandrill|ct\.sendgrid/i.test(u)) continue;
    for (let i = 0; i < 3; i++) {
      try {
        const g = await noFollowGet(u);
        const loc = clean(g.location);
        if (consider(u, loc)) return loc;
        break; // answered, but no confirm target
      } catch (e) {
        if (i === 2) log(`resolve ${u.slice(0, 80)} failed: ${e.message}`);
      }
      await lib.sleep(1200);
    }
  }
  // exits as a second route (some sendgrid edges may cap our line)
  for (const p of rpc.pool().slice(0, 8)) {
    for (const u of urls.filter((x) => /sendgrid\.net|mailgun|mandrill/i.test(x)).slice(0, 6)) {
      try {
        const g = await noFollowGet(u, { proxy: p });
        const loc = clean(g.location);
        if (loc && isConfirmLoc(loc)) {
          log(`resolved via ${p.raw} -> ${loc.slice(0, 140)}`);
          return loc;
        }
      } catch (e) {}
    }
  }
  return fallback;
}

/** Raw Mailtrap JSON detail (readable without the broker when the box lives). */
function mailtrapDetailGet(inboxId, msgId, { log = () => {}, timeoutMs = 20000 } = {}) {
  const url = `https://mailtrap.io/api/inbound/inboxes/${inboxId}/messages/${msgId}`;
  let tok;
  try {
    tok = fs.readFileSync(path.join(require('os').homedir(), '.river-mailtrap-token'), 'utf8').trim();
  } catch (e) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      {
        host: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'GET',
        family: 4,
        headers: { authorization: `Bearer ${tok}`, accept: 'application/json' },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(text));
          } catch (e) {
            resolve(null);
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function mailtrapDetail(inboxId, msgId, { log = () => {} } = {}) {
  // direct first — the first connects from this line are blackholed, so retry
  for (let i = 0; i < 5; i++) {
    const j = await mailtrapDetailGet(inboxId, msgId, { log });
    if (j && (j.id || j.html_body || j.text_body)) return j;
    await lib.sleep(1500);
  }
  for (const p of rpc.pool().slice(0, 10)) {
    try {
      const r = await lib.request(p, {
        url: `https://mailtrap.io/api/inbound/inboxes/${inboxId}/messages/${msgId}`,
        headers: { authorization: `Bearer ${fs.readFileSync(path.join(require('os').homedir(), '.river-mailtrap-token'), 'utf8').trim()}`, accept: 'application/json' },
        timeoutMs: 30000,
      });
      if (r.status === 200 && r.json) return r.json;
    } catch (e) {}
  }
  return null;
}

/**
 * Cohere's mail tokens are only accepted by the link's own route: the RPC
 * `RegisterConfirmEmailV2` answers "not in our system" for every token we
 * mint. A plain GET of the mail link 307s to
 * `/api/auth/confirm_email?token=…` and THAT first touch confirms the user
 * (a second touch answers "link has already been used"). The redirect to
 * /welcome/login?error=… is expected — the session is established by AuthV2.
 */
async function clickConfirm(link, { log = () => {}, tries = 12 } = {}) {
  let api = /\/api\/auth\/confirm_email/i.test(link) ? link : null;
  if (!api) {
    const g = await noFollowGet(link).catch(() => null);
    const loc = g && g.location ? new URL(g.location, link).toString() : null;
    api = loc || link.replace('/confirm-email', '/api/auth/confirm_email');
    log(`click route: ${String(loc || 'no redirect').slice(0, 140)}`);
  }
  const pool = rpc.pool();
  for (let i = 0; i < tries && pool.length; i++) {
    const p = pool[(Math.floor(Math.random() * pool.length) + i) % pool.length];
    try {
      const r = await lib.request(p, { url: api, timeoutMs: 40000, headers: { 'user-agent': lib.UA, accept: 'text/html,application/json' } });
      const loc = r.headers && r.headers.location ? new URL(r.headers.location, api).toString() : null;
      log(`click #${i + 1} ${r.status} -> ${loc ? loc.slice(0, 140) : String(r.text).slice(0, 90).replace(/\s+/g, ' ')}`);
      if (r.status === 200 || (r.status >= 300 && r.status < 400)) return { ok: true, status: r.status, location: loc };
      if (r.status === 400 || r.status === 404) return { ok: false, status: r.status };
    } catch (e) {
      if (i === tries - 1) log(`click last error: ${e.message}`);
    }
  }
  return { ok: false, status: null };
}

/**
 * The trial key lives behind onboarding: the freshly confirmed org sits at
 * accessType NONE and GetOrCreateDefaultAPIKey answers "your organization
 * does not have access" until the about-you profile setup runs. This is the
 * dashboard's own single call (about-you page → agreeToOnboarding with
 * agreementType PROFILE_SETUP); the org name must not contain '@' or the
 * signup address would be rejected as "forbidden characters".
 */
async function completeOnboarding(bearer, { log = () => {} } = {}) {
  const suffix = Math.random().toString(36).slice(2, 6);
  const profile = {
    name: 'Ahmet',
    lastName: 'Kaya',
    role: 'Machine Learning Engineer',
    otherRole: '',
    use: 'Text Generation',
    otherUse: '',
    orgName: `Asboo Labs ${suffix}`,
    marketingEmailsOpted: false,
  };
  const body = { agreementType: 'PROFILE_SETUP', agreementData: profile };
  for (let i = 0; i < 3; i++) {
    const r = await rpc.call('AgreeToOnboarding', body, { token: bearer, tries: 8 });
    log(`AgreeToOnboarding -> ${r.status} ${String(JSON.stringify(r.json !== undefined ? r.json : r.text || r.error || '')).slice(0, 160)}`);
    if (r.status === 200) return true;
    if (r.status === 400) return false; // semantic rejection — retrying cannot help
    await lib.sleep(2500);
  }
  return false;
}

/** Tries to confirm the account with the token(s) the mail link carries. */
async function confirmEmail(link, { email, runDir, log = () => {} } = {}) {
  const q = tokensFromLink(link);
  log(`link params: ${JSON.stringify(q).slice(0, 240)}`);
  const tokenLike = q.token || q.confirmation_token || q.code || q.__last || q.id;
  const variants = [
    ['RegisterConfirmEmailV2', { token: tokenLike, email }],
    ['RegisterConfirmEmailV2', { token: tokenLike }],
    ['RegisterConfirmEmailV2', { confirmationToken: tokenLike, email }],
    ['RegisterConfirmEmailV2', { email, code: tokenLike }],
    ['RegisterConfirmEmail', { token: tokenLike, email }],
    ['RegisterConfirmEmailV2', { id: q.id, token: q.token }],
  ];
  const seen = new Set();
  for (const [method, body] of variants) {
    const key = method + JSON.stringify(body);
    if (seen.has(key)) continue;
    seen.add(key);
    if (body.token === undefined) continue;
    const r = await rpc.call(method, body, { tries: 6 });
    log(`${method} ${JSON.stringify(body).slice(0, 120)} -> ${r.status} ${String(JSON.stringify(r.json || r.text || r.error || '')).slice(0, 200)}`);
    if (r.status === 200 && !/error|invalid|expired/i.test(JSON.stringify(r.json || ''))) {
      return { ok: true, method, body, tokens: r.json };
    }
  }
  // fall back to a real click: the mail link is a Next page that 307s into
  // /api/auth/confirm…, which performs the confirmation server-side; follow
  // the whole chain through exits (up to 6 hops).
  const pool = rpc.pool();
  let curl = link;
  for (let hop = 0; hop < 6; hop++) {
    const p = pool[(Math.floor(Math.random() * pool.length) + hop) % pool.length];
    try {
      const r = await lib.request(p, { url: curl, timeoutMs: 45000, headers: { accept: 'text/html,application/json', 'user-agent': lib.UA } });
      const loc = r.headers && r.headers.location ? new URL(r.headers.location, curl).toString() : null;
      log(`click hop${hop} ${r.status} ${curl.slice(0, 100)} -> ${loc ? loc.slice(0, 140) : String(r.text).slice(0, 90).replace(/\s+/g, ' ')}`);
      if (r.status >= 300 && r.status < 400 && loc) {
        curl = loc;
        continue;
      }
      if (r.status === 200) {
        let j = null;
        try {
          j = JSON.parse(r.text);
        } catch (e) {}
        if (j && j.bearerTokens) return { ok: true, method: 'click', tokens: j };
        if (/verif|confirm|success|already/i.test(r.text)) return { ok: true, method: 'click', tokens: null };
        return { ok: false, method: 'click', status: r.status, text: String(r.text).slice(0, 200) };
      }
      return { ok: false, method: 'click', status: r.status };
    } catch (e) {
      log(`click hop${hop} failed: ${e.message}`);
    }
  }
  return { ok: false };
}

/** Login through the Blobheart auth surface; returns bearer tokens if any. */
async function login(email, password, { log = () => {} } = {}) {
  const attempts = [
    ['AuthV2', { email, password }],
    ['authV2', { email, password }],
    ['AuthWithPassword', { email, password }],
    ['Login', { email, password }],
  ];
  for (const [method, body] of attempts) {
    const r = await rpc.call(method, body, { tries: 6 });
    if (r.status === 404) continue;
    log(`login ${method} -> ${r.status} ${String(JSON.stringify(r.json || r.text || r.error || '')).slice(0, 200)}`);
    if (r.status === 200 && r.json) {
      const tokens = r.json.bearerTokens || r.json.tokens || r.json;
      const access = tokens.accessToken || tokens.access_token || tokens.token || null;
      if (access) return { ok: true, access, refresh: tokens.refreshToken || tokens.refresh_token || null, raw: tokens };
    }
  }
  return { ok: false };
}

/** The trial key is created with the account; fetch it (create if needed). */
async function fetchKey(bearer, { log = () => {} } = {}) {
  const order = [
    ['GetOrCreateDefaultAPIKey', {}],
    ['ListAPIKeys', {}],
    ['ListAPIKeys', { pageSize: 20 }],
    ['ViewRawAPIKey', {}],
  ];
  const keys = [];
  for (const [method, body] of order) {
    const r = await rpc.call(method, body, { token: bearer || null, tries: 6 });
    log(`${method} -> ${r.status} ${String(JSON.stringify(r.json || r.text || r.error || '')).slice(0, 300)}`);
    if (r.status !== 200 || !r.json) continue;
    const found = flow.scrapeKeys ? [] : [];
    const deep = findKeys(r.json);
    keys.push(...deep);
    if (deep.length && method === 'GetOrCreateDefaultAPIKey') return { ok: true, key: deep[0], raw: r.json };
  }
  if (keys.length) return { ok: true, key: keys[0], raw: null };
  return { ok: false };
}

function findKeys(obj, depth = 0, out = []) {
  if (obj === null || obj === undefined || depth > 7) return out;
  if (typeof obj === 'string') {
    if (/^[A-Za-z0-9]{38,48}$/.test(obj) && /[A-Za-z]/.test(obj) && /[0-9]/.test(obj)) out.push(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) findKeys(v, depth + 1, out);
    return out;
  }
  if (typeof obj === 'object') for (const k of Object.keys(obj)) findKeys(obj[k], depth + 1, out);
  return out;
}

/**
 * Full post-registration pipeline for one account. Returns
 * { ok, key, bearer, confirm, log }.
 */
async function finishAccount({ email, password, mailPort, token, link = null, runDir, log = () => {} }) {
  const trace = [];
  const say = (m) => {
    trace.push(m);
    log(m);
  };
  let mail = null;
  if (!link) {
    mail = await lib.waitForMail(mailPort, token, /confirm your email address|https?:\/\/[^\s"'<>)]*cohere\.(com|ai)\/confirm/i, {
      timeoutMs: parseInt(process.env.CH_MAIL_WAIT_MS || '240000', 10),
      pollMs: 5000,
    });
    if (!mail) return { ok: false, error: 'no mail', trace };
    let subject = mail.subject || '';
    let text = mail.text || '';
    let html = mail.html || '';
    const extract = () => [
      ...new Set(
        (`${text}\n${html}`.match(/https?:\/\/[^\s"'<>)\]]+/g) || []).map((u) => u.replace(/&amp;/g, '&').replace(/[)\].,]+$/, ''))
      ),
    ];
    let urls = extract();
    if (!urls.length) {
      // the broker list row sometimes carries an empty body (detail not yet
      // readable) — re-read the detail a few times, then ask Mailtrap directly
      for (let i = 0; i < 5 && !urls.length; i++) {
        await lib.sleep(3000);
        try {
          const one = await lib.brokerRead(mailPort, token, mail.id);
          text = one.text || text;
          html = one.html || html;
        } catch (e) {}
        urls = extract();
      }
    }
    if (!urls.length && !/@/.test(String(token))) {
      const d = await mailtrapDetail(token, mail.id, { log: say }).catch(() => null);
      if (d) {
        subject = d.subject || subject;
        text = d.text_body || d.raw_text_body || text;
        html = d.html_body || d.raw_html_body || html;
        urls = extract();
        say(`mailtrap direct detail: html=${String(html).length}b text=${String(text).length}b urls=${urls.length}`);
      }
    }
    link =
      urls.find((u) => /cohere\.(com|ai)/i.test(u) && /confirm|verify|activate/i.test(u)) ||
      (await resolveTracking(urls, { log: say }));
    say(`mail "${subject}" urls=${urls.length} link=${link ? link.slice(0, 160) : 'NONE'}`);
    if (!link) return { ok: false, error: 'no confirm link in mail', trace, urls };
    if (runDir && mail.id) fs.writeFileSync(path.join(runDir, 'mail-raw.json'), JSON.stringify({ id: mail.id, subject, text, html }, null, 2));
  } else if (!/cohere\.(com|ai)/i.test(link)) {
    // a tracking URL (sendgrid) — resolve it to the real dashboard target
    link = (await resolveTracking([link], { log: say })) || link;
  }

  // Cohere's mail tokens are accepted only by the click route — try it first,
  // fall back to the RPC variants (they answer "not in our system" for every
  // minted token, but stay as a safety net if the route is unreachable).
  let conf = await clickConfirm(link, { log: say });
  if (!conf.ok) {
    const rpcConf = await confirmEmail(link, { email, runDir, log: say });
    conf = rpcConf.ok ? rpcConf : { ...conf, method: 'click-route' };
  }
  if (runDir) fs.writeFileSync(path.join(runDir, 'confirm.json'), JSON.stringify(conf, null, 2));

  let bearer = null;
  if (conf.tokens) {
    const t = conf.tokens.bearerTokens || conf.tokens;
    bearer = t.accessToken || t.access_token || t.token || null;
  }
  if (!bearer) {
    const li = await login(email, password, { log: say });
    if (li.ok) bearer = li.access;
  }
  if (!bearer) {
    // consumed but not linked yet, or a dead exit dropped the click — retry
    for (let i = 0; i < 2 && !bearer; i++) {
      say(`confirm retry ${i + 1}`);
      await clickConfirm(link, { log: say });
      const li = await login(email, password, { log: say });
      if (li.ok) bearer = li.access;
    }
  }
  if (bearer) await completeOnboarding(bearer, { log: say }).catch(() => {});
  say(`bearer ${bearer ? String(bearer).slice(0, 10) + '…' : 'none'}`);

  let k = await fetchKey(bearer, { log: say });
  if (!k.ok && bearer) {
    await completeOnboarding(bearer, { log: say }).catch(() => {});
    k = await fetchKey(bearer, { log: say });
  }
  if (!k.ok) return { ok: false, error: 'no key', trace, link, bearer };
  return { ok: true, key: k.key, bearer, link, trace, confirm: conf };
}

module.exports = { finishAccount, confirmEmail, login, fetchKey, tokensFromLink, findKeys, resolveTracking, noFollowGet, clickConfirm, completeOnboarding };
