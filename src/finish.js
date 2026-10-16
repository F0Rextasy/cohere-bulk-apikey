'use strict';
// Finisher for one registered account: evidence about its Mailtrap inbox,
// then — if a message is there — the post chain (confirm -> bearer -> trial
// key) and a live verify; otherwise an AuthV2 login probe tells whether the
// account exists at all.
//
//   node src/finish.js                                   # box set below
//   node src/finish.js --box=5812 --email=… --password=… # any cohere-bulk box
//
// Mailtrap is the box provider, not the target, so reading it is allowed and
// has three routes tried in order:
//   A) direct from our line (family:4, up to 12 tries / 2 s — this line
//      blackholes/refuses the first connects)
//   B) the proxy pool (lib.loadProxies -> lib.request) — runs when A is not a
//      clean 200 (deleted-box cross-check), unless A answered 200
//   C) the local broker (:9700) that created the box — same condition as B
// Cohere traffic never leaves through our own line (rpc.js rotates exits).
//
// Evidence: out/inbox-<id>.json (rewritten after every phase). Nothing is
// deleted anywhere.

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const lib = require('./lib');
const post = require('./post');
const verify = require('./verify');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const flag = (name) => args.includes(`--${name}`);

const DEFAULTS = {
  box: '<box-id>',
  email: '<your-mailtrap-inbox>',
  password: '<your-mailtrap-password>',
  registered: '<registered-at>',
};
const BOX = {
  id: parseInt(opt('box', DEFAULTS.box), 10),
  address: opt('email', DEFAULTS.email),
  password: opt('password', DEFAULTS.password),
  registered: opt('registered', DEFAULTS.registered),
};
const CROSS = flag('cross') || BOX.id === 5364;
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = path.join(lib.OUT, `finish-${BOX.id}-${STAMP}`);
const EVIDENCE = path.join(lib.OUT, `inbox-${BOX.id}.json`);
const TOKEN = fs.readFileSync(path.join(os.homedir(), '.river-mailtrap-token'), 'utf8').trim();

const say = (m) => lib.log('finisher', m);
const evidence = { at: new Date().toISOString(), box: { id: BOX.id, address: BOX.address, registered: BOX.registered }, routes: {}, mail: null, post: null, login: null, verify: null, key: null, verdict: null };
const save = () => lib.saveJson(EVIDENCE, evidence);

const LINK_RE = /https?:\/\/[^\s"'<>)\]]+/g;
const isConclusive = (s) => s === 200 || s === 404 || s === 401 || s === 403;

// ------------------------------------------------------------------ route A

function directGet(pathq, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const req = https.request(
      {
        method: 'GET',
        host: 'mailtrap.io',
        port: 443,
        path: pathq,
        family: 4,
        timeout: timeoutMs,
        headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode, text: text.slice(0, 200000), ms: Date.now() - t0 }));
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    req.on('error', (e) => reject(new Error(`${e.message} (${Date.now() - t0}ms)`)));
    req.end();
  });
}

async function routeDirect() {
  const r = { tries: [] };
  for (let i = 0; i < 12; i++) {
    try {
      const g = await directGet(`/api/inbound/inboxes/${BOX.id}/messages`);
      const row = { attempt: i + 1, status: g.status, ms: g.ms, snippet: g.text.slice(0, 240) };
      r.tries.push(row);
      say(`direct #${i + 1} -> ${g.status} ${g.ms}ms ${row.snippet.replace(/\s+/g, ' ').slice(0, 160)}`);
      if (isConclusive(g.status)) {
        r.conclusive = { status: g.status, text: g.text, attempt: i + 1 };
        break;
      }
    } catch (e) {
      r.tries.push({ attempt: i + 1, error: e.message });
      say(`direct #${i + 1} -> ${e.message}`);
    }
    if (i < 11) await lib.sleep(2000);
  }
  // Reachability + namespace check: folders, then river-bulk's inbox list.
  try {
    const f = await directGet('/api/inbound/folders');
    r.folders = { status: f.status, text: f.text.slice(0, 1500) };
    if (f.status === 200) {
      let list = [];
      try {
        list = JSON.parse(f.text);
      } catch (e) {}
      const rows = Array.isArray(list) ? list : list.folders || [];
      const rb = rows.find((x) => x.name === 'river-bulk');
      if (rb) {
        const inv = await directGet(`/api/inbound/folders/${rb.id}/inboxes`).catch((e) => ({ error: e.message }));
        r.folderInboxes = inv.status ? { status: inv.status, text: inv.text.slice(0, 4000) } : { error: inv.error };
      }
    }
  } catch (e) {
    r.folders = { error: e.message };
  }
  return r;
}

// ------------------------------------------------------------------ route B

async function proxyGet(proxy, pathq, timeoutMs = 25000) {
  const t0 = Date.now();
  try {
    const res = await lib.request(proxy, {
      url: `https://mailtrap.io${pathq}`,
      headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
      timeoutMs,
    });
    return { status: res.status, text: res.text.slice(0, 200000), ms: Date.now() - t0, proxy: proxy.raw };
  } catch (e) {
    return { error: e.message, ms: Date.now() - t0, proxy: proxy.raw };
  }
}

async function routeProxy() {
  const pool = lib.loadProxies();
  const cand = pool.slice(0, 24);
  const r = { pool: pool.length, candidates: cand.length, rounds: 2, deadlineMs: 300000, tried: [] };
  const deadline = Date.now() + r.deadlineMs;
  const start = Math.floor(Math.random() * Math.max(1, cand.length));
  outer: for (let round = 0; round < 2; round++) {
    for (let i = 0; i < cand.length; i++) {
      if (Date.now() > deadline) {
        r.stopped = `deadline after ${r.tried.length} tries`;
        break outer;
      }
      const p = cand[(start + i) % cand.length];
      const g = await proxyGet(p, `/api/inbound/inboxes/${BOX.id}/messages`);
      r.tried.push({ round, proxy: p.raw, status: g.status || null, error: g.error || null, ms: g.ms, snippet: g.text ? String(g.text).slice(0, 200) : null });
      say(`proxy r${round} ${p.raw} -> ${g.status || g.error} ${g.ms}ms`);
      if (isConclusive(g.status)) {
        r.conclusive = { round, proxy: p.raw, status: g.status, text: g.text };
        break outer;
      }
      if (Date.now() > deadline) break outer;
    }
  }
  if (!r.conclusive && !r.stopped) r.stopped = `all ${r.tried.length} tries inconclusive`;
  return r;
}

// ------------------------------------------------------------------ route C

async function routeBroker() {
  const r = { tries: [] };
  for (let i = 0; i < 2; i++) {
    const t0 = Date.now();
    try {
      const j = await lib.brokerList(9700, String(BOX.id));
      const row = { attempt: i + 1, ms: Date.now() - t0, json: JSON.stringify(j).slice(0, 1200) };
      r.tries.push(row);
      say(`broker #${i + 1} -> ${row.ms}ms ${row.json.slice(0, 200)}`);
      if (j && (Array.isArray(j) || j.messages)) {
        r.list = j;
        break;
      }
    } catch (e) {
      r.tries.push({ attempt: i + 1, ms: Date.now() - t0, error: e.message });
      say(`broker #${i + 1} -> ${e.message}`);
    }
  }
  return r;
}

// --------------------------------------------------------------- mail detail

function parseList(text) {
  try {
    const j = JSON.parse(text);
    return Array.isArray(j) ? j : j.data || j.messages || [];
  } catch (e) {
    return [];
  }
}

/** Detail fetch straight from a route we already know answers. */
async function fetchDetail(id, proxyRaw) {
  const pathq = `/api/inbound/inboxes/${BOX.id}/messages/${id}`;
  if (proxyRaw) {
    const g = await proxyGet(lib.parseProxy(proxyRaw) || { raw: proxyRaw }, pathq);
    if (g.status === 200) return { via: `proxy ${proxyRaw}`, json: JSON.parse(g.text) };
    throw new Error(`proxy detail ${g.status || g.error}`);
  }
  for (let i = 0; i < 6; i++) {
    try {
      const g = await directGet(pathq);
      if (g.status === 200) return { via: 'direct', json: JSON.parse(g.text) };
      if (isConclusive(g.status)) throw new Error(`direct detail ${g.status}`);
    } catch (e) {
      if (/detail \d+/.test(e.message)) throw e;
    }
    await lib.sleep(2000);
  }
  throw new Error('direct detail unreachable');
}

function allUrls(msg) {
  const blob = [msg.text, msg.text_body, msg.html, msg.html_body, JSON.stringify(msg)]
    .filter(Boolean)
    .join('\n')
    .replace(/&amp;/g, '&');
  return [...new Set(blob.match(LINK_RE) || [])];
}

function linksFrom(msg) {
  return allUrls(msg).filter((u) => /confirm|verif|activate|token/i.test(u));
}

/**
 * Cohere's mail goes out through SendGrid click tracking: every href is a
 * `ct.sendgrid.net/ls/click?upn=…` wrapper and none of them contains
 * "confirm". A no-follow GET (sendgrid only — the redirect target is never
 * fetched from our line) hands back the real link in `Location`.
 */
function noFollowGet(url, timeoutMs = 20000) {
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

async function resolveTracking(urls, limit = 20) {
  for (const u of urls.slice(0, limit)) {
    if (!/sendgrid\.net/i.test(u)) continue;
    for (let i = 0; i < 3; i++) {
      try {
        const g = await noFollowGet(u);
        const loc = g.location ? g.location.replace(/&amp;/g, '&') : null;
        if (loc && /cohere\.(com|ai)/i.test(loc)) return { from: u.slice(0, 120), link: loc };
        break; // answered, but not a cohere redirect
      } catch (e) {
        if (i === 2) say(`resolve ${u.slice(0, 80)} failed: ${e.message}`);
      }
      await lib.sleep(1500);
    }
  }
  return null;
}

// ------------------------------------------------------------------- login

async function bounded(promise, ms, label) {
  return Promise.race([promise, lib.sleep(ms).then(() => ({ ok: false, timeout: true, error: `${label} exceeded ${Math.round(ms / 1000)}s` }))]);
}

// ------------------------------------------------------------------- main

(async () => {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  say(`inbox ${BOX.id} read start (${BOX.address}) -> ${EVIDENCE}`);

  evidence.routes.direct = await routeDirect();
  save();

  const directOk = evidence.routes.direct.conclusive && evidence.routes.direct.conclusive.status === 200;
  if (!directOk || CROSS) {
    if (!directOk) say(`direct not 200 (${evidence.routes.direct.conclusive ? evidence.routes.direct.conclusive.status : 'unreachable'}); pool cross-check`);
    evidence.routes.proxy = await routeProxy();
    save();
    evidence.routes.broker = await routeBroker();
    save();
  } else {
    say('direct answered 200; pool/broker cross-check skipped');
  }

  const statuses = [];
  if (evidence.routes.direct.conclusive) statuses.push(evidence.routes.direct.conclusive.status);
  if (evidence.routes.proxy && evidence.routes.proxy.conclusive) statuses.push(evidence.routes.proxy.conclusive.status);
  const any200 = directOk || (evidence.routes.proxy && evidence.routes.proxy.conclusive && evidence.routes.proxy.conclusive.status === 200);
  evidence.verdict = any200 ? 'reachable' : statuses.includes(404) ? 'deleted(404)' : 'unreachable';

  // Mail?
  let msgs = [];
  if (directOk) msgs = parseList(evidence.routes.direct.conclusive.text);
  if (!msgs.length && evidence.routes.proxy && evidence.routes.proxy.conclusive && evidence.routes.proxy.conclusive.status === 200)
    msgs = parseList(evidence.routes.proxy.conclusive.text);
  if (!msgs.length && evidence.routes.broker && evidence.routes.broker.list) {
    const l = evidence.routes.broker.list;
    msgs = Array.isArray(l) ? l : l.messages || [];
  }
  evidence.messageCount = msgs.length;

  if (msgs.length) {
    const first = msgs[0];
    const id = first.id || first.message_id;
    say(`mail present: id=${id} subject="${first.subject || ''}"`);
    let detail = null;
    try {
      detail = await fetchDetail(id, evidence.routes.proxy && evidence.routes.proxy.conclusive && evidence.routes.proxy.conclusive.status === 200 ? evidence.routes.proxy.conclusive.proxy : null);
    } catch (e) {
      say(`detail fetch failed (${e.message}); trying broker read`);
      detail = await lib.brokerRead(9700, String(BOX.id), id).then((j) => ({ via: 'broker', json: j })).catch((x) => ({ via: 'none', error: x.message }));
    }
    const msg = (detail && detail.json) || first;
    fs.writeFileSync(path.join(RUN_DIR, 'mail.json'), JSON.stringify(msg, null, 2));
    const links = linksFrom(msg);
    evidence.mail = { id, subject: msg.subject || first.subject || '', via: detail.via, links, text: String(msg.text || msg.text_body || '').slice(0, 4000) };
    save();
    const link = links[0] || null;
    if (link) {
      say(`link ${link.slice(0, 160)}`);
      const p = await post.finishAccount({ email: BOX.address, password: BOX.password, mailPort: 9700, token: String(BOX.id), link, runDir: RUN_DIR, log: say });
      evidence.post = { ok: p.ok, error: p.error || null, trace: p.trace };
      save();
      if (p.ok && p.key) {
        const v = await bounded(verify.verifyAny(p.key), 300000, 'verify');
        evidence.verify = { ok: !!v.ok, status: v.status || v.err, model: v.model, proxy: v.proxy || null };
        evidence.key = `${p.key.slice(0, 4)}…${p.key.slice(-4)}`;
        if (v.ok) {
          const fresh = lib.appendKey(p.key, { address: BOX.address, proxy: v.proxy || null, via: 'finisher' });
          const af = path.join(lib.ROOT, 'accounts.json');
          const accounts = lib.loadJson(af, []);
          accounts.push({ address: BOX.address, password: BOX.password, key: p.key, proxy: v.proxy || null, at: lib.stamp() });
          lib.saveJson(af, accounts);
          say(`KEY ${evidence.key} stored (${fresh ? 'new' : 'dupe'}), verified live via ${v.proxy}`);
        } else {
          fs.appendFileSync(path.join(lib.OUT, 'unverified-keys.txt'), p.key + '\n');
          say(`key ${evidence.key} unverified: ${JSON.stringify(v).slice(0, 160)}`);
        }
      } else {
        say(`post chain failed: ${p.error}`);
      }
      save();
    } else {
      say('mail present but no confirm link found in it');
    }
  } else {
    say(`no message in inbox ${BOX.id} (verdict ${evidence.verdict})`);
  }

  // Account-existence probe, independent of the mailbox: AuthV2 login.
  const haveKey = evidence.key && evidence.verify && evidence.verify.ok;
  if (!haveKey) {
    say('login probe (AuthV2) start');
    const li = await bounded(post.login(BOX.address, BOX.password, { log: say }), 240000, 'login');
    evidence.login = { ok: !!li.ok, timeout: !!li.timeout, error: li.error || null };
    save();
    if (li.ok && li.access) {
      say('login accepted -> pulling trial key');
      const k = await bounded(post.fetchKey(li.access, { log: say }), 240000, 'fetchKey');
      if (k.ok) {
        const v = await bounded(verify.verifyAny(k.key), 300000, 'verify');
        evidence.verify = { ok: !!v.ok, status: v.status || v.err, model: v.model, proxy: v.proxy || null };
        evidence.key = `${k.key.slice(0, 4)}…${k.key.slice(-4)}`;
        if (v.ok) {
          const fresh = lib.appendKey(k.key, { address: BOX.address, proxy: v.proxy || null, via: 'finisher-login' });
          const af = path.join(lib.ROOT, 'accounts.json');
          const accounts = lib.loadJson(af, []);
          accounts.push({ address: BOX.address, password: BOX.password, key: k.key, proxy: v.proxy || null, at: lib.stamp() });
          lib.saveJson(af, accounts);
          say(`KEY ${evidence.key} stored (login path, ${fresh ? 'new' : 'dupe'}), verified live via ${v.proxy}`);
        } else {
          fs.appendFileSync(path.join(lib.OUT, 'unverified-keys.txt'), k.key + '\n');
          say(`key ${evidence.key} unverified: ${JSON.stringify(v).slice(0, 160)}`);
        }
      } else {
        say(`fetchKey failed: ${k.error || k.timeout}`);
      }
    } else {
      say(`login probe: ${li.error || 'no bearer'}`);
    }
    save();
  } else {
    say('login probe skipped (key already verified)');
  }

  say(`finish done: verdict=${evidence.verdict} mail=${evidence.messageCount || 0} login=${evidence.login ? (evidence.login.ok ? 'ok' : evidence.login.error || 'fail') : 'n/a'} key=${evidence.key || 'none'}`);
})().catch((e) => {
  say(`finish FAIL ${e.stack}`);
  save();
  process.exit(1);
});
