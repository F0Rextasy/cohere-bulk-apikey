'use strict';
// Soak: an exit is only usable for the browser flow if it can carry the full
// page payload (Next.js chunks) AND Google's reCAPTCHA Enterprise script, at a
// usable speed. Public exits that answer one TLS probe often die mid-page.
//
//   node soak.js [--in=out/live-exits.txt] [--out=out/good-exits.txt] [--min-kbs=60]
//
// Writes: proxy<TAB>kbs<TAB>registerMs<TAB>appMs<TAB>recaptchaMs<TAB>totalMs

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const IN = opt('in', path.join(lib.OUT, 'live-exits.txt'));
const OUT = opt('out', path.join(lib.OUT, 'good-exits.txt'));
const MIN_KBS = parseFloat(opt('min-kbs', '40'));
const CONC = Math.min(4, parseInt(opt('conc', '4'), 10));
const RECAPTCHA_KEY = '6LfwwhgpAAAAAJiItLCXBrm2UJpZe9xzFkaiXFiA';
const DASH = 'https://dashboard.cohere.com';

function lines() {
  return fs
    .readFileSync(IN, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [raw, cohere, google] = l.split('\t');
      return { raw, cohere: +cohere, google: +google, proxy: lib.parseProxy(raw) };
    })
    .filter((r) => r.proxy);
}

async function timed(proxy, url, { expect200 = true, minLen = 1 } = {}) {
  const t0 = Date.now();
  const res = await lib.request(proxy, { url, timeoutMs: 45000, headers: { accept: '*/*' } });
  const ms = Date.now() - t0;
  if (expect200 && res.status !== 200) throw new Error(`${res.status} for ${url}`);
  if (res.text.length < minLen) throw new Error(`short body ${res.text.length} for ${url}`);
  return { ms, len: res.text.length, body: res.text };
}

async function soakOne(row) {
  const p = row.proxy;
  try {
    const page = await timed(p, DASH + '/welcome/register?email=soak%40example.com', { minLen: 5000 });
    const m = page.body.match(/\/_next\/static\/chunks\/pages\/welcome\/register-[a-f0-9]+\.js/);
    const appChunk = page.body.match(/\/_next\/static\/chunks\/pages\/_app-[a-f0-9]+\.js/);
    if (!m || !appChunk) throw new Error('chunk names not in page');
    const app = await timed(p, DASH + appChunk[0], { minLen: 500000 });
    const kbs = Math.round(app.len / 1024 / (app.ms / 1000));
    const cap = await timed(p, `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_KEY}`, { minLen: 500 });
    const reg = await timed(p, DASH + m[0], { minLen: 5000 });
    return {
      ok: kbs >= MIN_KBS && cap.body.length > 500,
      kbs,
      ms: { register: page.ms, app: app.ms, recaptcha: cap.ms, regchunk: reg.ms },
      note: cap.body.length < 10000 ? 'captcha script suspicious (block page?)' : '',
    };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

(async () => {
  const rows = lines();
  lib.log('soak', `candidates=${rows.length} minKBs=${MIN_KBS}`);
  fs.mkdirSync(lib.OUT, { recursive: true });
  fs.writeFileSync(OUT, '');
  const queue = rows.slice().sort((a, b) => (b.google > 0) - (a.google > 0) || a.cohere - b.cohere);
  let done = 0;
  let good = 0;
  const workers = Array.from({ length: CONC }, async () => {
    while (queue.length) {
      const row = queue.shift();
      const r = await soakOne(row);
      done++;
      if (r.ok) {
        good++;
        const line = [row.raw, r.kbs, r.ms.register, r.ms.app, r.ms.recaptcha, r.ms.regchunk].join('\t');
        fs.appendFileSync(OUT, line + '\n');
        lib.log('soak', `GOOD ${row.raw} ${r.kbs} KB/s cap=${r.ms.recaptcha}ms ${r.note}`);
      } else {
        lib.log('soak', `drop ${row.raw}: ${r.err || `slow ${r.kbs} KB/s`}`);
      }
    }
  });
  await Promise.all(workers);
  lib.log('soak', `done: ${good} good of ${done} soaked -> ${OUT}`);
})().catch((e) => {
  lib.log('soak', `FAIL ${e.stack}`);
  process.exit(1);
});
