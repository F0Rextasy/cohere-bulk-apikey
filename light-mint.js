'use strict';
// Batch engine for the light path: N accounts, one mailbox + one exit per
// account, several accounts in flight, resumable (keys.txt is the record).
//
//   node light-mint.js [--count=30] [--port=9351] [--workers=2] [--headless]
//     [--bypass-google] [--keep] [--budget-min=600]
//
// Split of work per account:
//   browser phase (exit-bound, ~1-3 min): SSR register page + reCAPTCHA token
//                                          + RegisterWithEmail POST
//   post phase    (exit-rotating, Node):  mail -> confirm -> bearer -> trial key
// Only the browser phase needs one exit to stay alive; the post phase retries
// across the whole pool, so an exit dying after the POST costs nothing.
//
// One Chrome, one isolated context per attempt (its own exit and storage).

const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const B = require('./browser');
const flow = require('./flow');
const light = require('./light');
const recaptcha = require('./recaptcha-cache');
const post = require('./post');
const verify = require('./verify');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const flag = (name) => args.includes(`--${name}`);

const COUNT = parseInt(opt('count', '30'), 10);
const PORT = parseInt(opt('port', '9351'), 10);
const MAIL_PORT = parseInt(opt('mail', '9700'), 10);
const WORKERS = Math.max(1, Math.min(4, parseInt(opt('workers', '2'), 10)));
const HEADLESS = flag('headless');
const KEEP = flag('keep');
const BUDGET_MS = parseInt(opt('budget-min', '600'), 10) * 60000;
const BYPASS = flag('bypass-google')
  ? ['www.google.com', 'www.gstatic.com', 'recaptcha.net', '*.google.com', '*.gstatic.com', '*.recaptcha.net'].join(',')
  : null;
const OUTCOMES = path.join(lib.OUT, 'exit-outcomes.json');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = path.join(lib.ROOT, 'out', `light-mint-${stamp}`);
const started = Date.now();
const inUse = new Set();
let attempts = 0;
let keyCount = 0;

function keysCount() {
  try {
    return fs.readFileSync(path.join(lib.ROOT, 'keys.txt'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
  } catch (e) {
    return 0;
  }
}

function loadOutcomes() {
  return lib.loadJson(OUTCOMES, {});
}

function noteExit(raw, patch) {
  const all = loadOutcomes();
  const cur = all[raw] || { attempts: 0, ok: 0, stages: {} };
  if (patch.attempt) cur.attempts += 1;
  if (patch.ok) cur.ok = (cur.ok || 0) + 1;
  if (patch.stage) cur.stages[patch.stage] = (cur.stages[patch.stage] || 0) + 1;
  cur.last = { at: lib.stamp(), stage: patch.stage || null, error: patch.error || null, ok: !!patch.ok };
  all[raw] = cur;
  lib.saveJson(OUTCOMES, all);
}

/** Exit candidates, best first: google-capable live, warm, router, good. */
function exitCandidates() {
  const rows = [];
  const push = (raw, rank) => {
    if (raw) rows.push({ raw: raw.trim(), rank });
  };
  const readTabbed = (f) => {
    try {
      return fs.readFileSync(path.join(lib.OUT, f), 'utf8').split(/\r?\n/).filter(Boolean);
    } catch (e) {
      return [];
    }
  };
  for (const l of readTabbed('live-exits.txt')) {
    const [raw, cohere, google] = l.split('\t');
    const g = Number(google);
    push(raw, (g > 0 ? 0 : 60000) + (+cohere || 99999) + (g > 0 ? g : 0));
  }
  for (const l of readTabbed('warm-exits.txt')) {
    const [raw, hits, rounds] = l.split('\t');
    push(raw, 100 + (Number(rounds) - Number(hits)) * 1000);
  }
  for (const f of ['router-cohere-live.txt', '../../out/router-cohere-live.txt']) {
    for (const l of readTabbed(f)) push(l.split('\t')[0], 3000);
  }
  for (const l of readTabbed('good-exits.txt')) push(l.split('\t')[0], 2000);
  rows.sort((a, b) => a.rank - b.rank);
  const outcomes = loadOutcomes();
  return [...new Set(rows.map((r) => r.raw))]
    .map((r) => ({ raw: r, bad: outcomes[r] && outcomes[r].ok === 0 && outcomes[r].attempts >= 2 ? 1 : 0 }))
    .sort((a, b) => a.bad - b.bad)
    .map((r) => lib.parseProxy(r.raw))
    .filter(Boolean);
}

/** Browser phase: one account registered through one exit. */
async function browserPhase(cdp, { box, mailPort, acctDir }) {
  const candidates = exitCandidates().filter((p) => !inUse.has(p.raw));
  for (const proxy of candidates.slice(0, 4)) {
    inUse.add(proxy.raw);
    let ctx = null;
    let teardown = null;
    let cacheTeardown = null;
    const t0 = Date.now();
    try {
      ctx = await B.openContext(cdp, BYPASS ? { proxyServer: lib.proxyLib.browserUrl(proxy), proxyBypassList: BYPASS } : { proxyServer: lib.proxyLib.browserUrl(proxy) });
      if (proxy.username) teardown = await lib.proxyLib.attachProxyAuth(cdp, ctx.sessionId, proxy);
      cacheTeardown = await recaptcha.install(cdp, ctx.sessionId, { log: (m) => lib.log('light-mint', m) }).catch(() => null);
      const ip = await light.egressCheck(cdp, ctx.sessionId);
      if (!ip) throw new Error('egress check failed');
      lib.log('light-mint', `${box.address}: exit ${proxy.raw} up as ${ip}`);
      noteExit(proxy.raw, { attempt: true, stage: 'egress', ok: true });

      const res = await light.runLight(cdp, ctx.sessionId, {
        address: box.address,
        token: box.token,
        mailPort,
        proxy,
        runDir: acctDir,
        registerOnly: true,
      });
      noteExit(proxy.raw, { attempt: false, stage: res.stage, ok: res.ok, error: res.error });
      lib.log('light-mint', `${box.address}: browser phase ok=${res.ok} stage=${res.stage} in ${Math.round((Date.now() - t0) / 1000)}s ${res.error || ''}`);
      if (res.ok || !res.exitRetry) return { res, proxy };
      // exit-caused: same mailbox, next exit
    } catch (e) {
      noteExit(proxy.raw, { attempt: true, stage: 'setup', ok: false, error: e.message });
      lib.log('light-mint', `${box.address}: exit ${proxy.raw} preflight failed: ${e.message}`);
    } finally {
      try {
        if (cacheTeardown) await cacheTeardown();
      } catch (e) {}
      try {
        if (teardown) await teardown();
      } catch (e) {}
      try {
        if (ctx) await cdp.disposeBrowserContext(ctx.browserContextId);
      } catch (e) {}
      inUse.delete(proxy.raw);
    }
  }
  return { res: { ok: false, error: 'no exit carried the browser phase', stage: 'setup' }, proxy: null };
}

/** Post phase: mail -> confirm -> bearer -> key, exit-rotating. */
async function postPhase({ box, mailPort, acctDir, password }) {
  const r = await post.finishAccount({
    email: box.address,
    password,
    mailPort,
    token: box.token,
    runDir: acctDir,
    log: (m) => lib.log('light-mint', `${box.address}: ${m}`),
  });
  return r;
}

(async () => {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  keyCount = keysCount();
  const target = keyCount + COUNT;
  lib.log('light-mint', `target ${target} keys (have ${keyCount}), workers ${WORKERS}, dir ${RUN_DIR}`);

  const rc = await recaptcha.ensure({ log: (m) => lib.log('light-mint', m) }).catch((e) => ({ ok: false, error: e.message }));
  lib.log('light-mint', `recaptcha cache: ${JSON.stringify(rc)}`);

  const chrome = B.launchChrome(PORT, 'light-mint', { headless: HEADLESS });
  const cdp = await B.connect(PORT);
  lib.log('light-mint', `chrome pid ${chrome.pid}`);

  const summary = [];
  try {
    const worker = async (id) => {
      while (keysCount() < target && Date.now() - started < BUDGET_MS) {
        attempts++;
        const n = attempts;
        const acctDir = path.join(RUN_DIR, `a${String(n).padStart(3, '0')}`);
        fs.mkdirSync(acctDir, { recursive: true });
        const box = await lib.mailboxCreate(MAIL_PORT).catch((e) => {
          lib.log('light-mint', `w${id}: mailbox failed: ${e.message}`);
          return null;
        });
        if (!box) {
          await lib.sleep(20000);
          continue;
        }
        const mailPort = box.port || MAIL_PORT;
        lib.log('light-mint', `--- w${id} attempt ${n}: mailbox ${box.address} (broker ${mailPort}) ---`);

        const { res, proxy } = await browserPhase(cdp, { box, mailPort, acctDir });
        const record = { attempt: n, worker: id, mailbox: box.address, exit: proxy && proxy.raw, browser: { ok: res.ok, stage: res.stage, error: res.error } };

        if (res.ok) {
          const p = await postPhase({ box, mailPort, acctDir, password: res.password });
          record.post = { ok: p.ok, error: p.error, key: p.key ? `${p.key.slice(0, 4)}…${p.key.slice(-4)}` : null };
          if (p.ok) {
            const v = await verify.verifyAny(p.key).catch(() => ({ ok: false }));
            record.verify = v;
            if (v.ok) {
              const fresh = lib.appendKey(p.key, { address: box.address, proxy: proxy ? proxy.raw : null, attempt: n });
              const accountsFile = path.join(lib.ROOT, 'accounts.json');
              const accounts = lib.loadJson(accountsFile, []);
              accounts.push({ address: box.address, password: res.password, key: p.key, proxy: proxy ? proxy.raw : null, at: lib.stamp() });
              lib.saveJson(accountsFile, accounts);
              keyCount = keysCount();
              lib.log('light-mint', `KEY ${p.key.slice(0, 6)}…${p.key.slice(-4)} ${fresh ? 'stored' : 'dupe'} — total ${keyCount}/${target}`);
            } else {
              lib.log('light-mint', `w${id}: key failed live verify: ${JSON.stringify(v).slice(0, 160)}`);
            }
          } else {
            lib.log('light-mint', `w${id}: post phase failed: ${p.error}`);
          }
        }
        summary.push(record);
        lib.saveJson(path.join(lib.OUT, 'light-mint-state.json'), {
          updated_at: new Date().toISOString(),
          attempts,
          keys: keysCount(),
          target,
          run_dir: RUN_DIR,
        });
        lib.saveJson(path.join(RUN_DIR, 'summary.json'), { target, attempts, keys: keysCount(), summary });
        await lib.sleep(1500 + Math.random() * 2500);
      }
    };

    await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i + 1)));
  } finally {
    lib.saveJson(path.join(RUN_DIR, 'summary.json'), { target, attempts, keys: keysCount(), summary });
    try {
      cdp.close();
    } catch (e) {}
    if (!KEEP) {
      const { spawnSync } = require('child_process');
      try {
        spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } catch (e) {}
    }
    lib.log('light-mint', `run over: ${keysCount()} keys total, ${attempts} attempts`);
  }
})().catch((e) => {
  lib.log('light-mint', `FAIL ${e.stack}`);
  process.exit(1);
});
