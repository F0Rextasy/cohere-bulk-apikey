'use strict';
// Stability screen: an exit that answers one probe is not an exit that stays
// alive for a five-minute browser signup. Probe each candidate 5× over ~5
// minutes (60 s apart) and keep the ones that answer 4/5+.
//
//   node stable.js [--want=24] [--rounds=5] [--gap=60] [--conc=6]
//     [--host=dashboard.cohere.com]
//
// Writes out/warm-exits.txt: proxy<TAB>hits<TAB>rounds<TAB>avgMs

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const WANT = parseInt(opt('want', '24'), 10);
const ROUNDS = parseInt(opt('rounds', '5'), 10);
const GAP = parseFloat(opt('gap', '60')) * 1000;
const CONC = Math.min(6, parseInt(opt('conc', '6'), 10));
const HOST = opt('host', 'dashboard.cohere.com');
const NEED = Math.max(1, Math.ceil(ROUNDS * 0.8));
const OUT = path.join(lib.OUT, 'warm-exits.txt');

function candidates() {
  const rows = [];
  for (const f of ['good-exits.txt', 'live-exits.txt', 'router-cohere-live.txt', '../../out/router-cohere-live.txt']) {
    try {
      for (const l of fs.readFileSync(path.join(lib.OUT, f), 'utf8').split(/\r?\n/)) {
        const p = l.split('\t')[0].trim();
        if (p) rows.push(p);
      }
    } catch (e) {}
  }
  // plus a slice of the shared union pool, so a dead own-list can still yield
  try {
    const union = fs.readFileSync(path.join(__dirname, 'out', 'union-live.txt'), 'utf8').split(/\r?\n/);
    rows.push(...union.slice(0, 120));
  } catch (e) {}
  return [...new Set(rows.map((r) => r.trim()).filter(Boolean))].map((r) => lib.parseProxy(r)).filter(Boolean).sort(() => Math.random() - 0.5);
}

(async () => {
  const cands = candidates();
  lib.log('stable', `candidates=${cands.length} host=${HOST} rounds=${ROUNDS} need=${NEED}/${ROUNDS}`);
  const stats = new Map(cands.map((p) => [p.raw, { proxy: p, hits: 0, ms: [] }]));

  for (let round = 1; round <= ROUNDS; round++) {
    const queue = cands.slice();
    let ok = 0;
    await Promise.all(
      Array.from({ length: CONC }, async () => {
        while (queue.length) {
          const p = queue.shift();
          const s = stats.get(p.raw);
          try {
            const r = await lib.proxyLib.probe(p, { host: HOST, port: 443, timeoutMs: 20000 });
            if (r.ok) {
              s.hits++;
              s.ms.push(r.ms);
              ok++;
            }
          } catch (e) {}
        }
      })
    );
    lib.log('stable', `round ${round}/${ROUNDS}: ${ok}/${cands.length} answered`);
    if (round < ROUNDS) await lib.sleep(GAP);
  }

  const kept = [...stats.values()]
    .filter((s) => s.hits >= NEED)
    .sort((a, b) => b.hits - a.hits || avg(a.ms) - avg(b.ms))
    .slice(0, Math.max(WANT, 8));
  fs.writeFileSync(OUT, kept.map((s) => `${s.proxy.raw}\t${s.hits}\t${ROUNDS}\t${avg(s.ms)}`).join('\n') + (kept.length ? '\n' : ''));
  lib.log('stable', `warm pool: ${kept.length} exits (>=${NEED}/${ROUNDS}) -> ${OUT}`);
  for (const s of kept.slice(0, 20)) lib.log('stable', `  ${s.proxy.raw} ${s.hits}/${ROUNDS} avg ${avg(s.ms)}ms`);
})().catch((e) => {
  lib.log('stable', `FAIL ${e.stack}`);
  process.exit(1);
});

function avg(a) {
  return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 999999;
}
