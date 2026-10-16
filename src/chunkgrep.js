'use strict';
// Fetches specific dashboard chunks through live exits and greps them for a
// pattern.   node src/chunkgrep.js <pattern> <chunkUrl...>

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const pattern = process.argv[2];
const urls = process.argv.slice(3);
if (!pattern || !urls.length) throw new Error('usage: node src/chunkgrep.js <pattern> <url...>');

function candidates() {
  const f = path.join(lib.ROOT, 'out', 'good-exits.txt');
  const g = path.join(lib.ROOT, 'out', 'live-exits.txt');
  const read = (p) =>
    fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t')[0]) : [];
  return [...new Set([...read(f), ...read(g)])].map((r) => lib.parseProxy(r)).filter(Boolean).sort(() => Math.random() - 0.5);
}

(async () => {
  const cands = candidates();
  if (!cands.length) throw new Error('no exits; run probe.js');
  const re = new RegExp(pattern, 'i');
  for (const u of urls) {
    let body = null;
    let used = null;
    for (const p of cands.slice(0, 12)) {
      try {
        const r = await lib.request(p, { url: u.startsWith('http') ? u : 'https://dashboard.cohere.com' + u, timeoutMs: 45000 });
        if (r.status === 200 && r.text.length > 200) {
          body = r.text;
          used = p.raw;
          break;
        }
      } catch (e) {}
    }
    if (!body) {
      lib.log('chunkgrep', `${u} unreachable`);
      continue;
    }
    const name = path.basename(u.split('?')[0]);
    fs.writeFileSync(path.join(lib.OUT, 'recon', name), body);
    lib.log('chunkgrep', `${name} ${body.length} bytes via ${used}`);
    let n = 0;
    for (const m of body.matchAll(new RegExp(`.{0,220}${pattern}.{0,320}`, 'gi'))) {
      console.log(`[${name}] ${m[0].replace(/\s+/g, ' ')}`);
      if (++n >= 12) break;
    }
    if (!n) console.log(`[${name}] (no match for ${pattern})`);
  }
})().catch((e) => {
  lib.log('chunkgrep', `FAIL ${e.stack}`);
  process.exit(1);
});
