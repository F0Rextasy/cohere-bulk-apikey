'use strict';
// Shared plumbing for the Cohere mint: proxy HTTP with cookies, mail broker
// (9700 Mailtrap / 9701 inboxes.com), account/key store, logging.

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');
const proxyLib = require('./proxy.js');

const ROOT = path.join(__dirname);
const LOGS = path.join(ROOT, 'logs');
const OUT = path.join(ROOT, 'out');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

function stamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(tag, msg) {
  fs.mkdirSync(LOGS, { recursive: true });
  const line = `[${stamp()}] ${tag} ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(path.join(LOGS, 'cohere.log'), line + '\n');
  } catch (e) {}
}

/** Minimal cookie jar keyed by name. */
class Jar {
  constructor() {
    this.cookies = new Map();
  }
  absorb(setCookie) {
    if (!setCookie) return;
    for (const c of Array.isArray(setCookie) ? setCookie : [setCookie]) {
      const [pair] = String(c).split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

/**
 * One HTTPS request through `proxy` (null = direct, avoid). Returns
 * { status, headers, text, json, cookies }.
 */
function request(proxy, { method = 'GET', url, headers = {}, body, timeoutMs = 45000, jar }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload =
      body === undefined || body === null
        ? null
        : Buffer.isBuffer(body)
          ? body
          : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const finalHeaders = { 'user-agent': UA, ...headers };
    if (payload && !Object.keys(finalHeaders).some((h) => h.toLowerCase() === 'content-type'))
      finalHeaders['Content-Type'] = 'application/json';
    if (payload) finalHeaders['Content-Length'] = payload.length;
    if (jar && jar.header()) finalHeaders['cookie'] = jar.header();

    const req = https.request(
      {
        method,
        host: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        agent: proxy ? proxyLib.createAgent(proxy) : undefined,
        headers: finalHeaders,
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          if (jar) jar.absorb(res.headers['set-cookie']);
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (e) {}
          resolve({ status: res.statusCode, headers: res.headers, text, json, cookies: res.headers['set-cookie'] || [] });
        });
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout ${method} ${url}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ------------------------------------------------------------- mail broker

// Cohere blocks the disposable mail-broker domains but accepts gmail;
// Emailnator's gmail pool is the working mailbox there.
let emailnator = null;
try {
  emailnator = require('../../cloudflare-wai/emailnator');
} catch (e) {}

const isEmailnatorToken = (token) => typeof token === 'string' && token.includes('@');

/** Mailbox creation for the current provider (`COHERE_MAILBOX=emailnator`). */
async function mailboxCreate(port = 9700) {
  if (String(process.env.COHERE_MAILBOX || '').toLowerCase() === 'emailnator' && emailnator) {
    // Emailnator gmail addresses come from a shared, history-rich pool: prefer
    // one that has never seen a Cohere mail (an address Cohere already knows
    // answers 403 "you cannot register with this email").
    let best = null;
    for (let i = 0; i < 4; i++) {
      const a = await emailnator.newAddress(null);
      let msgs = [];
      try {
        msgs = await emailnator.listMessages(a.plain, null, { limit: 20 });
      } catch (e) {}
      const cohereHit = msgs.some((m) => /cohere/i.test(`${m.from || ''} ${m.subject || ''}`));
      if (!cohereHit && msgs.length === 0) return { address: a.plain, token: a.plain, port: 0, provider: 'emailnator', msgs: 0 };
      if (!best || (best.cohereHit && !cohereHit) || (best.cohereHit === cohereHit && msgs.length < best.msgs)) {
        best = { address: a.plain, token: a.plain, port: 0, provider: 'emailnator', msgs: msgs.length, cohereHit };
      }
      if (!cohereHit && msgs.length <= 1) break;
    }
    return best;
  }
  return brokerCreate(port);
}

function brokerGet(port, pathq, method = 'GET', timeoutMs = 30000, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body === null || body === undefined ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = payload.length;
    }
    const req = http.request({ host: '127.0.0.1', port, path: pathq, method, timeout: timeoutMs, headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (text += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          reject(new Error(`broker ${pathq} non-JSON: ${text.slice(0, 120)}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`broker ${pathq} timeout`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function brokerCreate(port = 9700, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const folder = process.env.COHERE_MAILTRAP_FOLDER || 'cohere-bulk';
      const r = await brokerGet(port, '/create', 'POST', 150000, { folder });
      if (r && r.address && r.token && r.token !== 'undefined') return { ...r, port };
      last = new Error(`broker create bad response: ${JSON.stringify(r)}`);
    } catch (e) {
      last = e;
    }
    await sleep(2500 * (i + 1));
  }
  if (port !== 9701) {
    try {
      return await brokerCreate(9701, 2);
    } catch (e) {}
  }
  throw last;
}

async function brokerList(port, token) {
  if (isEmailnatorToken(token) && emailnator) {
    const msgs = await emailnator.listMessages(token, null, {}).catch(() => []);
    const out = [];
    for (const m of msgs) {
      const id = String(m.id || m.message_id);
      const subject = m.subject || '';
      const from = m.from || '';
      // Bodies are fetched lazily (waitForMail re-reads candidates); the pooled
      // gmail boxes are history-rich, so avoid reading 20 bodies per poll.
      if (!/cohere|confirm|verif/i.test(`${from} ${subject}`)) {
        out.push({ id, subject, from, text: '', html: '', skip: true });
        continue;
      }
      let rec = { id, subject, from, text: '', html: '' };
      try {
        const r = await emailnator.readMessage(id, null);
        rec = { id, subject: r.subject || subject, from: r.from || from, text: String(r.text || r.textBody || ''), html: String(r.content || r.html || r.htmlBody || '') };
      } catch (e) {}
      out.push(rec);
    }
    return out;
  }
  return brokerGet(port, `/list?token=${encodeURIComponent(token)}`);
}

async function brokerRead(port, token, id) {
  if (isEmailnatorToken(token) && emailnator) {
    const r = await emailnator.readMessage(id, null);
    return { id: String(id), subject: r.subject || '', from: r.from || '', text: String(r.text || r.textBody || ''), html: String(r.content || r.html || r.htmlBody || '') };
  }
  return brokerGet(port, `/read?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
}

/** Polls the broker until a message matching `re` shows up. */
async function waitForMail(port, token, re, { timeoutMs = 240000, pollMs = 4000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const seen = new Set();
  while (Date.now() < deadline) {
    let msgs = [];
    try {
      const list = await brokerList(port, token);
      msgs = Array.isArray(list) ? list : list.messages || [];
    } catch (e) {
      await sleep(pollMs);
      continue;
    }
    for (const m of msgs) {
      const id = String(m.id);
      if (seen.has(id)) continue;
      if (m.skip) continue; // non-candidate row (pooled mailbox) — no body read needed
      seen.add(id);
      let full = m;
      if (m.text === undefined || (!m.text && !m.html)) {
        try {
          full = await brokerRead(port, token, id);
        } catch (e) {}
      }
      const blob = `${full.subject || ''}\n${full.text || ''}\n${full.html || ''}`;
      const match = blob.match(re);
      if (match) return { id, subject: full.subject || '', text: full.text || '', html: full.html || '', match };
    }
    await sleep(pollMs);
  }
  return null;
}

// ------------------------------------------------------------------ store

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function saveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

/** Append a key to keys.txt (dedup) + meta + user mirror. */
function appendKey(key, meta = {}) {
  fs.mkdirSync(ROOT, { recursive: true });
  const keysFile = path.join(ROOT, 'keys.txt');
  const line = key.trim();
  if (!line) return false;
  const current = fs.existsSync(keysFile) ? fs.readFileSync(keysFile, 'utf8') : '';
  const has = current.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).includes(line);
  if (has) return false;
  fs.appendFileSync(keysFile, line + '\n');
  fs.appendFileSync(path.join(ROOT, 'out', 'keys.meta.ndjson'), JSON.stringify({ key, at: stamp(), ...meta }) + '\n');
  const mirror = path.join(os.homedir(), 'cohere-keys.txt');
  try {
    fs.appendFileSync(mirror, line + '\n');
  } catch (e) {}
  return true;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const DEFAULT_POOL = [
  path.join(ROOT, 'out', 'live-exits.txt'),
  path.join(__dirname, 'out', 'union-live.txt'),
].find((f) => {
  try {
    return fs.existsSync(f) && fs.statSync(f).size > 0;
  } catch (e) {
    return false;
  }
});

function loadProxies(file = process.env.COHEERE_PROXY_LIST || process.env.COHERE_PROXY_LIST || DEFAULT_POOL) {
  // Measured 2026-10-14: while the upstream WAN flaps, exits that answer in a
  // healthy second need up to ~35 s; an 8 s CONNECT cap silently scores them
  // dead and the whole soak comes back empty. Budgets are deliberately long.
  const handshake = parseInt(process.env.CH_TUNNEL_TMO || '45000', 10);
  const connect = parseInt(process.env.CH_CONNECT_TMO || '20000', 10);
  return proxyLib
    .loadProxyList(file)
    .filter((p) => !proxyLib.isLocalHost(p.host))
    .map((p) => {
      p.timeoutMs = handshake;
      p.connectTimeoutMs = connect;
      return p;
    });
}

/** parseProxy + our long tunnel/connect budgets (raw parse returns no budgets). */
function parseProxy(raw) {
  const p = proxyLib.parseProxy(raw);
  if (!p) return null;
  p.timeoutMs = parseInt(process.env.CH_TUNNEL_TMO || '45000', 10);
  p.connectTimeoutMs = parseInt(process.env.CH_CONNECT_TMO || '20000', 10);
  return p;
}

module.exports = {
  UA,
  Jar,
  request,
  brokerCreate,
  mailboxCreate,
  brokerList,
  brokerRead,
  waitForMail,
  loadJson,
  saveJson,
  appendKey,
  sleep,
  loadProxies,
  parseProxy,
  log,
  proxyLib,
  ROOT,
  LOGS,
  OUT,
  stamp,
};
