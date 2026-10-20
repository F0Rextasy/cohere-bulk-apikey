'use strict';
// Verifies every key in keys.txt against the live API (models + a real chat
// completion), each attempt through a soaked exit, and writes models.json.
//   node src/verify.js [--keys=../keys.txt] [--limit=0]

const fs = require('fs');
const path = require('path');
const ROOT = ROOT; // data root (the repo root)
const lib = require('./lib');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const KEYS = opt('keys', path.join(lib.ROOT, 'keys.txt'));
const LIMIT = parseInt(opt('limit', '0'), 10);
const MODELS = ['command-a-03-2025', 'command-r7b-12-2024', 'command-r-08-2024'];

function exits() {
  const f = path.join(lib.OUT, 'good-exits.txt');
  const fromGood = fs.existsSync(f)
    ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t')[0])
    : [];
  const f2 = path.join(lib.OUT, 'live-exits.txt');
  const fromLive = fs.existsSync(f2)
    ? fs.readFileSync(f2, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t')[0])
    : [];
  // The published tree has no out/ — the user's own pool lives at proxies.txt.
  const f3 = path.join(ROOT, 'proxies.txt');
  const fromUser = fs.existsSync(f3)
    ? fs.readFileSync(f3, 'utf8').split(/\r?\n/).map((l) => l.split(/\s+#/)[0].trim()).filter(Boolean)
    : [];
  return [...new Set([...fromGood, ...fromLive, ...fromUser])].map((r) => lib.parseProxy(r)).filter(Boolean);
}

async function verifyOne(key, pool) {
  let lastErr = null;
  for (let i = 0; i < Math.min(pool.length, 10); i++) {
    const proxy = pool[(Math.floor(Math.random() * pool.length) + i) % pool.length];
    try {
      const models = await lib.request(proxy, {
        url: 'https://api.cohere.com/v1/models?page_size=100',
        headers: { authorization: `bearer ${key}`, accept: 'application/json' },
        timeoutMs: 40000,
      });
      if (models.status === 401) {
        return { ok: false, status: models.status, err: `models ${models.status}`, proxy: proxy.raw };
      }
      if (models.status === 403) {
        // 403 can be an exit/IP-class denial, not a key verdict — try the next exit
        lastErr = new Error(`models 403 via ${proxy.raw}`);
        continue;
      }
      let chat = null;
      let usedModel = null;
      for (const model of MODELS) {
        chat = await lib.request(proxy, {
          method: 'POST',
          url: 'https://api.cohere.com/v1/chat',
          headers: { authorization: `bearer ${key}`, accept: 'application/json' },
          body: { model, message: 'Reply with the single word: ok', max_tokens: 8, temperature: 0 },
          timeoutMs: 60000,
        });
        if (chat.status === 200 && chat.json && chat.json.text) {
          usedModel = model;
          break;
        }
        if (chat.status === 401 || chat.status === 403) break;
      }
      const modelList = models.json && Array.isArray(models.json.models) ? models.json.models.map((m) => m.name) : [];
      return {
        ok: !!(chat && chat.status === 200 && chat.json && chat.json.text),
        status: `models=${models.status} chat=${chat ? chat.status : 'n/a'}`,
        model: usedModel,
        text: chat && chat.json ? chat.json.text : null,
        models: modelList,
        proxy: proxy.raw,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  return { ok: false, err: `network: ${lastErr && lastErr.message}`, proxy: null };
}

const verifyAny = async (key, { tries = 8 } = {}) => {
  const found = exits();
  const pool = found.length ? found : [lib.DIRECT_EXIT];
  let last = null;
  for (const p of pool.slice(0, tries)) {
    const r = await verifyOne(key, [p]);
    if (r.ok) return { ...r, proxy: p.raw };
    last = r;
    if (/\b401\b/.test(String(r.status || r.err || ''))) return r;
  }
  return last || { ok: false, err: 'no exit could carry the verify' };
};

module.exports = { verifyOne, verifyAny, exits };

if (require.main === module) {
(async () => {
  const lines = fs.readFileSync(KEYS, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const keys = LIMIT > 0 ? lines.slice(0, LIMIT) : lines;
  // No pool = DIRECT mode: a proxy is recommended at scale (per-IP limits,
  // bans) but it is optional — the direct pseudo-exit keeps verify working.
  const found = exits();
  const pool = found.length ? found : [lib.DIRECT_EXIT];
  if (!found.length) lib.log('verify', 'no exit list — running WITHOUT a proxy (direct)');
  const outFile = path.join(lib.OUT, 'verify-report.txt');
  fs.mkdirSync(path.dirname(outFile), { recursive: true }); // a fresh clone has no out/
  fs.writeFileSync(outFile, '');
  lib.log('verify', `${keys.length} keys, ${pool.length} exits`);
  let okCount = 0;
  let modelsWritten = false;
  for (const key of keys) {
    const r = await verifyOne(key, pool);
    const short = `${key.slice(0, 4)}…${key.slice(-4)}`;
    const line = `${short}\t${r.ok ? 'LIVE' : 'DEAD'}\t${r.status || r.err}\tmodel=${r.model || '-'}\ttext=${JSON.stringify(r.text || '').slice(0, 60)}\texit=${r.proxy || '-'}`;
    fs.appendFileSync(outFile, line + '\n');
    lib.log('verify', line);
    if (r.ok) {
      okCount++;
      if (!modelsWritten && r.models && r.models.length) {
        lib.saveJson(path.join(__dirname, 'models.json'), { // the shipped catalogue sits beside the code
                    at: lib.stamp(),
          count: r.models.length,
          models: r.models,
        });
        modelsWritten = true;
      }
    }
  }
  lib.log('verify', `live ${okCount}/${keys.length} -> ${outFile}`);
})().catch((e) => {
  lib.log('verify', `FAIL ${e.stack}`);
  process.exit(1);
});

}
