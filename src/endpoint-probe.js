'use strict';
// Endpoint probe: find the dashboard's email-registration endpoint (and the
// session/csrf endpoints) by POSTing to candidates through live exits and
// reading whether the server answers with validation/captcha errors (real path)
// or 404 (wrong path). Sends one request per path; different exit each time.
//
//   node src/endpoint-probe.js [--from=out/live-exits.txt]

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const CANDIDATES = [
  ['POST', '/rpc/BlobheartAPI/RegisterWithEmail', 'os'],
  ['POST', '/rpc/BlobheartAPI/RegisterWithEmail', 'dash'],
  ['POST', '/rpc/BlobheartAPI/Register', 'os'],
  ['POST', '/rpc/BlobheartAPI/Register', 'dash'],
  ['POST', '/rpc/BlobheartAPI/Session', 'os'],
  ['POST', '/rpc/BlobheartAPI/Session', 'dash'],
  ['POST', '/rpc/BlobheartAPI/GetUserCsrfToken', 'os'],
  ['POST', '/rpc/BlobheartAPI/GetUserCsrfToken', 'dash'],
  ['GET', '/api/auth/session', 'dash'],
  ['GET', '/api/auth/csrf', 'dash'],
  ['GET', '/api/auth/providers', 'dash'],
  ['POST', '/api/auth/register_with_email', 'dash'],
  ['POST', '/api/auth/register', 'dash'],
  ['POST', '/api/auth/signup', 'dash'],
];

const BASES = {
  os: 'https://production.api.os.cohere.com',
  dash: 'https://dashboard.cohere.com',
};

function exits() {
  const files = ['proxies.txt', 'good-exits.txt', 'live-exits.txt'].map((f) => path.join(lib.OUT, f));
  const out = [];
  for (const f of files) {
    try {
      for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
        const raw = l.split('\t')[0].trim();
        if (raw) out.push(raw);
      }
    } catch (e) {}
  }
  return [...new Set(out)].map((r) => lib.parseProxy(r)).filter(Boolean).sort(() => Math.random() - 0.5);
}

async function send(pathq, method, base, pool) {
  const body =
    method === 'POST'
      ? { email: 'probe+cohere@example.com', password: 'Xy7!mQ2#vT9pLw', inviteHash: '', freeCreditCode: '', analyticsData: {} }
      : null;
  const headers = {
    accept: 'application/json',
    origin: 'https://dashboard.cohere.com',
    referer: 'https://dashboard.cohere.com/welcome/register',
    'X-Recaptcha-Token': '',
    'X-Email-Domain': 'example.com',
    'Connect-Protocol-Version': '1',
  };
  for (const p of pool.slice(0, 8)) {
    try {
      const r = await lib.request(p, { method, url: BASES[base] + pathq, headers, body, timeoutMs: 45000 });
      return { status: r.status, text: r.text.slice(0, 260), proxy: p.raw };
    } catch (e) {}
  }
  return { status: null, text: 'unreachable' };
}

(async () => {
  const pool = exits();
  lib.log('endpoint-probe', `${pool.length} exits available`);
  for (const [method, p, base] of CANDIDATES) {
    const r = await send(p, method, base, pool);
    lib.log('endpoint-probe', `${method} ${BASES[base]}${p} -> ${r.status} ${JSON.stringify(r.text).slice(0, 200)}`);
  }
})().catch((e) => {
  lib.log('endpoint-probe', `FAIL ${e.stack}`);
  process.exit(1);
});
