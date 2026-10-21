'use strict';
// Probes pool exits for Cohere + Google (reCAPTCHA host) reachability.
//   node src/probe.js [--target=40] [--conc=8] [--pool=path] [--hosts=a,b]
// Writes out/live-exits.txt: `proxy<TAB>cohereMs<TAB>googleMs` and a log.

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const TARGET = parseInt(opt('target', '40'), 10);
const CONC = Math.min(5, parseInt(opt('conc', '5'), 10));
const DEFAULT_POOL = path.join(lib.ROOT, 'out', 'union-live.txt');
const POOL = opt('pool', process.env.COHERE_PROXY_LIST || DEFAULT_POOL);
const OUT_FILE = opt('out', path.join(lib.OUT, 'live-exits.txt'));
const PRIMARY = 'dashboard.cohere.com';
const SECONDARY = 'www.google.com';

async function probeOne(p) {
  const t0 = Date.now();
  let cohere = 0;
  try {
    const r = await lib.proxyLib.probe(p, { host: PRIMARY, port: 443, timeoutMs: 30000 });
    if (!r.ok) return null;
    cohere = r.ms;
  } catch (e) {
    return null;
  }
  let google = -1;
  try {
    const r2 = await lib.proxyLib.probe(p, { host: SECONDARY, port: 443, timeoutMs: 25000 });
    if (r2.ok) google = r2.ms;
  } catch (e) {}
  return { proxy: p, cohere, google, total: Date.now() - t0 };
}

(async () => {
  const all = lib.loadProxies(POOL).filter((p) => lib.proxyLib.usableInBrowser ? lib.proxyLib.usableInBrowser(p) : true);
  const shuffled = all.slice().sort(() => Math.random() - 0.5);
  lib.log('probe', `pool=${POOL} lines=${all.length} target=${TARGET} conc=${CONC}`);
  fs.mkdirSync(lib.OUT, { recursive: true });
  const outPath = OUT_FILE;
  fs.writeFileSync(outPath, '');
  const queue = shuffled.slice();
  let found = 0;
  let scanned = 0;
  const start = Date.now();

  const workers = Array.from({ length: CONC }, async () => {
    while (queue.length && found < TARGET) {
      const p = queue.shift();
      scanned++;
      const r = await probeOne(p);
      if (r) {
        found++;
        const line = `${r.proxy.raw}\t${r.cohere}\t${r.google}`;
        fs.appendFileSync(outPath, line + '\n');
        lib.log('probe', `OK ${r.proxy.raw} cohere=${r.cohere}ms google=${r.google}ms (${found}/${TARGET})`);
      } else if (scanned % 25 === 0) {
        lib.log('probe', `scanned=${scanned} found=${found} elapsed=${Math.round((Date.now() - start) / 1000)}s`);
      }
    }
  });
  await Promise.all(workers);
  lib.log('probe', `done: scanned=${scanned} found=${found} in ${Math.round((Date.now() - start) / 1000)}s`);
})().catch((e) => {
  lib.log('probe', `FAIL ${e.stack}`);
  process.exit(1);
});
