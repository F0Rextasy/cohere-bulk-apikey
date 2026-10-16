'use strict';
// Hunt: grow the usable proxy pool from the large unverified candidate lists.
// Two phases, run in one process so nothing is duplicated:
//   1. screen candidates against dashboard.cohere.com + www.google.com
//   2. soak survivors with the full page payload (chunks + recaptcha script)
// Survivors are appended to out/good-exits.txt.
//
//   node hunt.js [--pool=../out/rw-big.txt] [--want=12] [--scan=400]
//                [--min-kbs=40] [--conc=5]

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const ROOT = lib.ROOT;
const POOL = opt('pool', path.join(__dirname, 'out', 'rw-big.txt'));
const WANT = parseInt(opt('want', '12'), 10);
const SCAN = parseInt(opt('scan', '400'), 10);
const MIN_KBS = parseFloat(opt('min-kbs', '40'));
const CONC = Math.min(6, parseInt(opt('conc', '5'), 10));
const GOOD_FILE = path.join(lib.OUT, 'good-exits.txt');
const RECAPTCHA_KEY = '6LfwwhgpAAAAAJiItLCXBrm2UJpZe9xzFkaiXFiA';
const DASH = 'https://dashboard.cohere.com';

function seen() {
  const set = new Set();
  for (const f of ['good-exits.txt', 'live-exits.txt']) {
    const p = path.join(lib.OUT, f);
    try {
      for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) if (l.trim()) set.add(l.split('\t')[0].trim());
    } catch (e) {}
  }
  return set;
}

async function screenOne(p) {
  try {
    const r = await lib.proxyLib.probe(p, { host: 'dashboard.cohere.com', port: 443, timeoutMs: 25000 });
    if (!r.ok) return null;
    let google = -1;
    try {
      const g = await lib.proxyLib.probe(p, { host: 'www.google.com', port: 443, timeoutMs: 20000 });
      if (g.ok) google = g.ms;
    } catch (e) {}
    return { proxy: p, cohere: r.ms, google };
  } catch (e) {
    return null;
  }
}

async function timed(proxy, url, { minLen = 1 } = {}) {
  const t0 = Date.now();
  const res = await lib.request(proxy, { url, timeoutMs: 45000, headers: { accept: '*/*' } });
  const ms = Date.now() - t0;
  if (res.status !== 200) throw new Error(`${res.status} ${url}`);
  if (res.text.length < minLen) throw new Error(`short ${res.text.length} ${url}`);
  return { ms, len: res.text.length, body: res.text };
}

async function soakOne(p) {
  try {
    const page = await timed(p, DASH + '/welcome/register?email=soak%40example.com', { minLen: 5000 });
    const m = page.body.match(/\/_next\/static\/chunks\/pages\/welcome\/register-[a-f0-9]+\.js/);
    const appChunk = page.body.match(/\/_next\/static\/chunks\/pages\/_app-[a-f0-9]+\.js/);
    if (!m || !appChunk) throw new Error('chunk names not in page');
    const app = await timed(p, DASH + appChunk[0], { minLen: 500000 });
    const kbs = Math.round(app.len / 1024 / (app.ms / 1000));
    // reCAPTCHA needs www.google.com for the bootstrap AND www.gstatic.com for
    // the runtime; a browser flow dies silently when either is unreachable.
    const cap = await timed(p, `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_KEY}`, { minLen: 500 });
    const release = (cap.body.match(/recaptcha\/releases\/([A-Za-z0-9_\-]+)\//) || [])[1];
    let gstatic = null;
    if (release) {
      gstatic = await timed(p, `https://www.gstatic.com/recaptcha/releases/${release}/recaptcha__en.js`, { minLen: 50000 });
    } else {
      gstatic = await timed(p, 'https://www.gstatic.com/recaptcha/api.js', { minLen: 5000 }).catch(() => ({ ms: -1, len: 0 }));
    }
    const reg = await timed(p, DASH + m[0], { minLen: 5000 });
    if (kbs < MIN_KBS) throw new Error(`slow ${kbs} KB/s`);
    return { kbs, ms: { register: page.ms, app: app.ms, recaptcha: cap.ms, regchunk: reg.ms, gstatic: gstatic.ms }, release: release || '-' };
  } catch (e) {
    return null;
  }
}

(async () => {
  const known = seen();
  const all = lib
    .loadProxies(POOL)
    .filter((p) => !known.has(p.raw))
    .sort(() => Math.random() - 0.5)
    .slice(0, SCAN);
  lib.log('hunt', `pool=${POOL} scan=${all.length} want=${WANT} conc=${CONC}`);
  const found = [];
  const queue = all.slice();
  let scanned = 0;
  const liveFile = path.join(lib.OUT, 'live-exits.txt');
  const appended = new Set(
    (() => {
      try {
        return fs.readFileSync(liveFile, 'utf8').split(/\r?\n/).map((l) => l.split('\t')[0].trim());
      } catch (e) {
        return [];
      }
    })()
  );

  // phase 1: reachability screen. A reachable exit is already useful for the
  // light path (page + one POST are a few KB), so it lands in live-exits.txt
  // right away; the soak below only decides who can carry a full SPA payload.
  await Promise.all(
    Array.from({ length: CONC }, async () => {
      while (queue.length && found.length < WANT * 3) {
        const p = queue.shift();
        scanned++;
        const r = await screenOne(p);
        if (r) {
          found.push(r);
          if (!appended.has(r.proxy.raw)) {
            appended.add(r.proxy.raw);
            fs.appendFileSync(liveFile, `${r.proxy.raw}\t${r.cohere}\t${r.google}\n`);
          }
          lib.log('hunt', `screen ok ${r.proxy.raw} cohere=${r.cohere} google=${r.google} (${found.length})`);
        }
      }
    })
  );
  lib.log('hunt', `screened ${scanned}, ${found.length} reachable; soaking`);

  // phase 2: soak, faster first
  const soakQueue = found.slice().sort((a, b) => (b.google > 0) - (a.google > 0) || a.cohere - b.cohere);
  let good = 0;
  await Promise.all(
    Array.from({ length: CONC }, async () => {
      while (soakQueue.length && good < WANT) {
        const row = soakQueue.shift();
        const s = await soakOne(row.proxy);
        if (s) {
          good++;
          const line = [row.proxy.raw, s.kbs, s.ms.register, s.ms.app, s.ms.recaptcha, s.ms.regchunk].join('\t');
          fs.appendFileSync(GOOD_FILE, line + '\n');
          const live = path.join(lib.OUT, 'live-exits.txt');
          fs.appendFileSync(live, `${row.proxy.raw}\t${row.cohere}\t${row.google}\n`);
          lib.log('hunt', `GOOD ${row.proxy.raw} ${s.kbs} KB/s cap=${s.ms.recaptcha}ms (${good}/${WANT})`);
        } else {
          lib.log('hunt', `soak drop ${row.proxy.raw}`);
        }
      }
    })
  );
  lib.log('hunt', `done: ${good} new good exits -> ${GOOD_FILE}`);
})().catch((e) => {
  lib.log('hunt', `FAIL ${e.stack}`);
  process.exit(1);
});
