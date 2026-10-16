'use strict';
// Clicks a mail confirm link in a real Chrome through one exit, watches the
// network, then checks /api-keys — the ground-truth check of what the click
// actually does server-side.
//
//   node src/click-confirm.js --url="https://dashboard.cohere.com/confirm-email?token=…" [--exit=line] [--keep]

const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const B = require('./browser');
const flow = require('./flow');

const args = process.argv.slice(2);
const opt = (n, d) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split('=').slice(1).join('=') : d;
};
const flag = (n) => args.includes(`--${n}`);

const TARGET = opt('url');
if (!TARGET) throw new Error('usage: node src/click-confirm.js --url=<confirm link> [--exit=line] [--keep]');
const EXIT = opt('exit', null);
const PORT = parseInt(opt('port', '9371'), 10);
const RUN = path.join(lib.OUT, `click-${new Date().toISOString().replace(/[:.]/g, '-')}`);

function pickExit() {
  if (EXIT) return lib.parseProxy(EXIT);
  for (const f of ['live-exits.txt', 'good-exits.txt', 'router-cohere-live.txt', '../../out/router-cohere-live.txt']) {
    try {
      for (const l of fs.readFileSync(path.join(lib.OUT, f), 'utf8').split(/\r?\n/)) {
        const raw = l.split('\t')[0].trim();
        if (raw) {
          const p = lib.parseProxy(raw);
          if (p) return p;
        }
      }
    } catch (e) {}
  }
  return null;
}

(async () => {
  fs.mkdirSync(RUN, { recursive: true });
  const proxy = pickExit();
  if (!proxy) throw new Error('no exit available');
  const chrome = B.launchChrome(PORT, 'click-confirm');
  const cdp = await B.connect(PORT);
  let ok = false;
  try {
    const ctx = await B.openContext(cdp, { proxyServer: lib.proxyLib.browserUrl(proxy) });
    const sid = ctx.sessionId;
    let teardown = null;
    if (proxy.username) teardown = await lib.proxyLib.attachProxyAuth(cdp, sid, proxy);
    const net = flow.attachNet(cdp, sid);

    lib.log('click-confirm', `exit ${proxy.raw} -> opening ${TARGET.slice(0, 120)}`);
    await flow.goto(cdp, sid, TARGET, { label: 'confirm-link' });
    await lib.sleep(6000);
    let st = await flow.pageState(cdp, sid).catch((e) => ({ err: e.message }));
    lib.log('click-confirm', `after click: url=${st.url} title=${String(st.title || '').slice(0, 60)}`);
    lib.log('click-confirm', `text: ${String(st.text || '').replace(/\s+/g, ' ').slice(0, 320)}`);

    const hits = net.filter((r) => /confirm|auth|session|rpc|apikey/i.test(r.url)).slice(-24).map((r) => `${r.method} ${r.url.slice(0, 130)}`);
    lib.log('click-confirm', `net (last ${hits.length}):\n  ${hits.join('\n  ')}`);
    fs.writeFileSync(path.join(RUN, 'net.json'), JSON.stringify(net, null, 2));

    await flow.goto(cdp, sid, 'https://dashboard.cohere.com/api-keys', { label: 'api-keys' });
    await lib.sleep(6000);
    st = await flow.pageState(cdp, sid).catch((e) => ({ err: e.message }));
    lib.log('click-confirm', `api-keys: url=${st.url} title=${String(st.title || '').slice(0, 60)}`);
    lib.log('click-confirm', `api-keys text: ${String(st.text || '').replace(/\s+/g, ' ').slice(0, 500)}`);
    fs.writeFileSync(path.join(RUN, 'final.json'), JSON.stringify(st, null, 2));
    await B.screenshot(cdp, sid, path.join(RUN, 'final.png')).catch(() => {});
    if (teardown) await teardown().catch(() => {});
    ok = /api-keys/.test(String(st.url)) && !/welcome\/login/.test(String(st.url));
  } finally {
    try {
      cdp.close();
    } catch (e) {}
    if (!flag('keep')) {
      try {
        process.kill(chrome.pid);
      } catch (e) {}
    }
    lib.log('click-confirm', `done ok=${ok} evidence in ${RUN}`);
  }
  process.exit(ok ? 0 : 2);
})().catch((e) => {
  lib.log('click-confirm', `FAIL ${e.stack}`);
  process.exit(1);
});
