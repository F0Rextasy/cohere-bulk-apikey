'use strict';
// Pilot: one Cohere account through one live exit in real Chrome.
//   node src/pilot.js [--proxy=line] [--mail=9700|9701] [--port=9340] [--headless] [--keep]
//
// Creates a fresh mailbox from the local broker, opens a Chrome context pinned
// to one pool exit (probed live for dashboard.cohere.com), runs the register ->
// email -> api-key flow, persists the key on success.

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

const PORT = parseInt(opt('port', '9340'), 10);
const MAIL_PORT = parseInt(opt('mail', '9700'), 10);
const HEADLESS = flag('headless');
const KEEP = flag('keep');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DIR = path.join(lib.ROOT, 'out', `pilot-${stamp}`);

function usedExits() {
  const f = path.join(lib.OUT, 'used-exits.json');
  return lib.loadJson(f, {});
}

function candidateExits() {
  const line = opt('proxy');
  if (line) return [lib.parseProxy(line)];
  const read = (f) => {
    try {
      return fs
        .readFileSync(path.join(lib.OUT, f), 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l) => {
          const parts = l.split('\t');
          return { raw: parts[0], cohere: +parts[1] || 99999, google: +parts[2] ?? (parts.length > 2 ? +parts[2] : -1), kbs: parts.length > 2 ? +parts[1] : 0 };
        });
    } catch (e) {
      return [];
    }
  };
  const used = usedExits();
  const good = read('good-exits.txt').map((r) => ({ raw: r.raw, rank: (r.kbs ? 0 : 0) + (+r.cohere || 0) })); // cohere col carries regMs here
  const live = read('live-exits.txt').map((r) => ({ raw: r.raw, rank: (+r.cohere || 0) + (+r.google > 0 ? +r.google : 0) }));
  const pool = [...good, ...live].filter((r) => !used[r.raw]);
  pool.sort((a, b) => a.rank - b.rank);
  return [...new Set(pool.map((r) => r.raw))].map((raw) => lib.parseProxy(raw)).filter(Boolean);
}

(async () => {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  lib.log('pilot', `run dir ${RUN_DIR}`);

  const cands = candidateExits();
  if (!cands.length) throw new Error('no candidate exits; run probe.js/soak.js');
  lib.log('pilot', `${cands.length} candidate exits`);

  const box = await lib.brokerCreate(MAIL_PORT);
  const mailPortUsed = box.port || MAIL_PORT;
  lib.log('pilot', `mailbox ${box.address} (broker ${mailPortUsed})`);

  const chrome = B.launchChrome(PORT, 'pilot', { headless: HEADLESS });
  lib.log('pilot', `chrome pid ${chrome.pid} profile ${chrome.profileDir}`);
  const cdp = await B.connect(PORT);

  let chosen = null;
  try {
    for (const proxy of cands.slice(0, 6)) {
      let ctx = null;
      let teardownAuth = null;
      try {
        lib.log('pilot', `trying exit ${proxy.raw}`);
        ctx = await B.openContext(cdp, { proxyServer: lib.proxyLib.browserUrl(proxy) });
        if (proxy.username) teardownAuth = await lib.proxyLib.attachProxyAuth(cdp, ctx.sessionId, proxy);
        const ip = await B.evalJs(cdp, ctx.sessionId, `fetch('https://api.ipify.org/?format=json').then(r=>r.json()).then(j=>j.ip)`).catch((e) => `ERR ${e.message}`);
        lib.log('pilot', `browser exit ip: ${ip}`);
        if (String(ip).startsWith('ERR')) throw new Error(String(ip));
        chosen = { proxy, ctx, teardownAuth };
        break;
      } catch (e) {
        lib.log('pilot', `exit ${proxy.raw} unusable: ${e.message}`);
        try {
          if (teardownAuth) await teardownAuth();
        } catch (err) {}
        try {
          if (ctx) await cdp.disposeBrowserContext(ctx.browserContextId);
        } catch (err) {}
      }
    }
    if (!chosen) throw new Error('no candidate exit carried the browser');

    const { proxy, ctx } = chosen;
    fs.writeFileSync(path.join(RUN_DIR, 'account.json'), JSON.stringify({ ...box, proxy: proxy.raw, port: PORT, at: lib.stamp() }, null, 2));

    const res = await flow.runAccount(cdp, ctx.sessionId, {
      index: 0,
      address: box.address,
      token: box.token,
      mailPort: mailPortUsed,
      proxy,
      runDir: RUN_DIR,
      headless: HEADLESS,
    });

    fs.writeFileSync(path.join(RUN_DIR, 'result.json'), JSON.stringify(res, null, 2));
    lib.log('pilot', `RESULT ok=${res.ok} stage=${res.stage} key=${res.key ? res.key.slice(0, 6) + '…' + res.key.slice(-4) : 'none'} err=${res.error || ''}`);
    if (res.ok) {
      lib.appendKey(res.key, { address: box.address, proxy: proxy.raw, via: 'pilot' });
      lib.log('pilot', `key stored in ${path.join(lib.ROOT, 'keys.txt')}`);
    }
  } finally {
    try {
      if (chosen && chosen.teardownAuth) await chosen.teardownAuth();
    } catch (e) {}
    try {
      cdp.close();
    } catch (e) {}
    if (!KEEP) {
      const { spawnSync } = require('child_process');
      try {
        spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      } catch (e) {}
    }
  }
})().catch((e) => {
  lib.log('pilot', `FAIL ${e.stack}`);
  process.exit(1);
});
