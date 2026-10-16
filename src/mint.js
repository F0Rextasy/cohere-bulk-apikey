'use strict';
// Batch mint: N Cohere accounts, one per fresh inbox + one per soaked exit.
//   node src/mint.js [--count=30] [--mail=9700|9701] [--port=9341] [--headless]
//    [--min-kbs=60] [--budget-min=600]
//
// One Chrome for the whole run; one isolated browser context per account (its
// own exit, its own cookies/storage). Keys are appended to keys.txt as each
// account lands, so the run is resumable: rerun with a smaller goal to top up.

const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const B = require('./browser');
const flow = require('./flow');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const flag = (name) => args.includes(`--${name}`);

const COUNT = parseInt(opt('count', '30'), 10);
const MAIL_PORT = parseInt(opt('mail', '9700'), 10);
const PORT = parseInt(opt('port', '9341'), 10);
const HEADLESS = flag('headless');
const BUDGET_MS = parseInt(opt('budget-min', '600'), 10) * 60000;
const KEEP = flag('keep');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = path.join(lib.ROOT, 'out', `mint-${stamp}`);
const STATE_FILE = path.join(lib.OUT, 'mint-state.json');

lib.log('mint', `target ${COUNT} keys, run dir ${RUN_DIR}`);

function keysHave() {
  const f = path.join(lib.ROOT, 'keys.txt');
  try {
    return fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
  } catch (e) {
    return 0;
  }
}

function goodExits(minKbs) {
  const f = path.join(lib.OUT, 'good-exits.txt');
  const used = lib.loadJson(path.join(lib.OUT, 'used-exits.json'), {});
  const rows = fs
    .readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const [raw, kbs, reg, app, cap, regchunk] = l.split('\t');
      return { raw, kbs: +kbs, reg: +reg, cap: +cap, regchunk: +regchunk };
    })
    .filter((r) => r.kbs >= minKbs && !used[r.raw]);
  rows.sort((a, b) => a.reg + a.regchunk + a.cap - (b.reg + b.regchunk + b.cap));
  return rows;
}

function markUsed(raw, info) {
  const f = path.join(lib.OUT, 'used-exits.json');
  const all = lib.loadJson(f, {});
  all[raw] = { ...info, at: lib.stamp() };
  lib.saveJson(f, all);
}

(async () => {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const started = Date.now();
  const targetKeys = keysHave() + COUNT;
  lib.log('mint', `have ${targetKeys - COUNT} keys, aiming for ${targetKeys}`);

  const chrome = B.launchChrome(PORT, 'mint', { headless: HEADLESS });
  lib.log('mint', `chrome pid ${chrome.pid} profile ${chrome.profileDir}`);
  const cdp = await B.connect(PORT);

  const results = [];
  let attempt = 0;
  const minKbs = parseFloat(opt('min-kbs', '60'));

  try {
    while (keysHave() < targetKeys && Date.now() - started < BUDGET_MS) {
      attempt++;
      const exits = goodExits(minKbs);
      if (!exits.length) {
        lib.log('mint', `no soaked exits left; run soak.js against a fresh pool first`);
        break;
      }
      const row = exits[Math.floor(Math.random() * Math.min(3, exits.length))];
      const proxy = lib.parseProxy(row.raw);
      const t0 = Date.now();
      lib.log('mint', `--- attempt ${attempt} via ${row.raw} (${row.kbs} KB/s) ---`);

      let box = null;
      let teardownAuth = null;
      let browserContextId = null;
      const acctDir = path.join(RUN_DIR, `a${String(attempt).padStart(2, '0')}`);
      fs.mkdirSync(acctDir, { recursive: true });
      try {
        box = await lib.brokerCreate(MAIL_PORT);
        const mailPortUsed = box.port || MAIL_PORT;
        lib.log('mint', `mailbox ${box.address}`);
        lib.saveJson(path.join(acctDir, 'account.json'), { ...box, proxy: row.raw, at: lib.stamp() });

        const ctx = await B.openContext(cdp, { proxyServer: lib.proxyLib.browserUrl(proxy) });
        browserContextId = ctx.browserContextId;
        if (proxy.username) teardownAuth = await lib.proxyLib.attachProxyAuth(cdp, ctx.sessionId, proxy);

        const ip = await B.evalJs(cdp, ctx.sessionId, `fetch('https://api.ipify.org/?format=json').then(r=>r.json()).then(j=>j.ip)`).catch((e) => `ERR ${e.message}`);
        lib.log('mint', `exit ip ${ip}`);
        if (String(ip).startsWith('ERR')) throw new Error(`browser egress broken: ${ip}`);

        const res = await flow.runAccount(cdp, ctx.sessionId, {
          index: attempt,
          address: box.address,
          token: box.token,
          mailPort: mailPortUsed,
          proxy,
          runDir: acctDir,
          headless: HEADLESS,
        });
        lib.saveJson(path.join(acctDir, 'result.json'), res);
        lib.log('mint', `attempt ${attempt}: ok=${res.ok} stage=${res.stage} err=${res.error || ''} ${Math.round((Date.now() - t0) / 1000)}s`);
        if (res.ok) {
          const isNew = lib.appendKey(res.key, { address: box.address, proxy: row.raw, attempt });
          markUsed(row.raw, { account: attempt, ok: true });
          const accountsFile = path.join(lib.ROOT, 'accounts.json');
          const accounts = lib.loadJson(accountsFile, []);
          accounts.push({ address: box.address, password: res.password, key: res.key, proxy: row.raw, at: lib.stamp() });
          lib.saveJson(accountsFile, accounts);
          lib.log('mint', `KEY ${res.key.slice(0, 6)}…${res.key.slice(-4)} ${isNew ? 'stored' : 'already had it'} — total ${keysHave()}`);
        } else {
          markUsed(row.raw, { account: attempt, ok: false, stage: res.stage, error: res.error });
        }
        // keep the account record for the report even when registration succeeded
        // only up to the key step
        lib.saveJson(STATE_FILE, {
          updated_at: new Date().toISOString(),
          attempts: attempt,
          keys: keysHave(),
          target: targetKeys,
          run_dir: RUN_DIR,
        });
      } catch (e) {
        lib.log('mint', `attempt ${attempt} failed: ${e.message}`);
        markUsed(row.raw, { account: attempt, ok: false, error: e.message });
      } finally {
        try {
          if (teardownAuth) await teardownAuth();
        } catch (e) {}
        try {
          if (browserContextId) await cdp.disposeBrowserContext(browserContextId);
        } catch (e) {}
      }
      // small human-ish gap between accounts
      await lib.sleep(3000 + Math.random() * 4000);
    }
  } finally {
    lib.saveJson(path.join(RUN_DIR, 'summary.json'), { attempts: attempt, keys: keysHave(), results });
    try {
      cdp.close();
    } catch (e) {}
    if (!KEEP) {
      const { spawnSync } = require('child_process');
      try {
        spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } catch (e) {}
    }
    lib.log('mint', `run over: ${keysHave()} keys total, ${attempt} attempts`);
  }
})().catch((e) => {
  lib.log('mint', `FAIL ${e.stack}`);
  process.exit(1);
});
