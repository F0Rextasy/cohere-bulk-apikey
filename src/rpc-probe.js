'use strict';
// Focused RPC probe: talks to the Blobheart RPC surface with detailed output
// (status, content-type, body bytes, trailer) so the wire format is known
// before scripting it.
//
//   node src/rpc-probe.js [--method=RegisterWithEmail] [--host=os|dash] [--token=...]

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const METHOD = opt('method', 'RegisterWithEmail');
const HOSTK = opt('host', 'os');
const TOKEN = opt('token', '');
const BASES = { os: 'https://production.api.os.cohere.com', dash: 'https://dashboard.cohere.com' };
const URL_ = `${BASES[HOSTK]}/rpc/BlobheartAPI/${METHOD}`;

function exits() {
  const rows = [];
  for (const f of ['warm-exits.txt', 'good-exits.txt', 'live-exits.txt']) {
    try {
      for (const l of fs.readFileSync(path.join(lib.OUT, f), 'utf8').split(/\r?\n/)) {
        const raw = l.split('\t')[0].trim();
        if (raw) rows.push(raw);
      }
    } catch (e) {}
  }
  return [...new Set(rows)].map((r) => lib.parseProxy(r)).filter(Boolean).sort(() => Math.random() - 0.5);
}

function preview(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'utf8');
  const head = b.slice(0, 180);
  const printable = head
    .toString('latin1')
    .replace(/[\x00-\x08\x0e-\x1f]/g, '.');
  return { len: b.length, hex: b.slice(0, 32).toString('hex'), text: printable };
}

async function call(proxy, { method, headers, body }) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const payload = body === null || body === undefined ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const finalHeaders = { 'user-agent': lib.UA, ...headers };
    if (payload) {
      finalHeaders['Content-Length'] = payload.length;
      if (!Object.keys(finalHeaders).some((h) => h.toLowerCase() === 'content-type')) finalHeaders['Content-Type'] = 'application/json';
    }
    const req = https.request(
      {
        method,
        host: new URL(URL_).hostname,
        port: 443,
        path: new URL(URL_).pathname,
        agent: lib.proxyLib.createAgent(proxy),
        headers: finalHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: preview(buf),
            raw: buf,
            trailer: buf.slice(-32).toString('latin1').replace(/[\x00-\x08\x0e-\x1f]/g, '.'),
          });
        });
      }
    );
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const pool = exits();
  lib.log('rpc-probe', `${pool.length} exits; ${METHOD} @ ${BASES[HOSTK]}`);

  const variants = [
    {
      name: 'json + empty token',
      headers: { 'content-type': 'application/json', 'X-Recaptcha-Token': TOKEN, 'X-Email-Domain': 'example.com', origin: 'https://dashboard.cohere.com', referer: 'https://dashboard.cohere.com/welcome/register' },
      body: { email: 'probe+cohere@example.com', password: `Probe!${Date.now().toString(36)}#7x`, inviteHash: '', freeCreditCode: '', analyticsData: {} },
    },
    {
      name: 'json empty body',
      headers: { 'content-type': 'application/json', 'X-Recaptcha-Token': TOKEN, 'X-Email-Domain': 'example.com', origin: 'https://dashboard.cohere.com' },
      body: {},
    },
    {
      name: 'no content-type, empty body',
      headers: { 'X-Recaptcha-Token': TOKEN, origin: 'https://dashboard.cohere.com' },
      body: null,
    },
    {
      name: 'grpc-web text',
      headers: { 'content-type': 'application/grpc-web+proto', 'x-grpc-web': '1', origin: 'https://dashboard.cohere.com' },
      body: Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]),
    },
  ];

  for (const v of variants) {
    let done = false;
    for (const p of pool.slice(0, 8)) {
      try {
        const r = await call(p, { method: 'POST', headers: v.headers, body: v.body });
        lib.log(
          'rpc-probe',
          `[${v.name}] -> ${r.status} ct=${r.headers['content-type'] || '-'} len=${r.body.len} hex=${r.body.hex} text="${r.body.text.slice(0, 140)}" trailer="${r.trailer.slice(0, 40)}" via ${p.raw}`
        );
        done = true;
        break;
      } catch (e) {
        /* next exit */
      }
    }
    if (!done) lib.log('rpc-probe', `[${v.name}] unreachable through ${Math.min(8, pool.length)} exits`);
  }
})().catch((e) => {
  lib.log('rpc-probe', `FAIL ${e.stack}`);
  process.exit(1);
});
