'use strict';
// Light path: the dashboard SPA is never loaded. The browser is only a
// reCAPTCHA-token factory plus the cookie/credential holder; every cohere call
// is the same RPC the SPA would make, done in-page (so origin/cookies/CORS all
// match) against /rpc/BlobheartAPI/<Method>.
//
// Payload per account: register HTML (~26 KB) + enterprise.js (~small), vs
// ~2.5 MB for the SPA route — which is what makes it survivable on free exits.
//
//   node src/light-pilot.js [--exit=line] [--keep] [--headless]

const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const B = require('./browser');
const flow = require('./flow');
const recaptcha = require('./recaptcha-cache');
// The captcha engine (pageEval + the reCAPTCHA Enterprise token) lives in
// src/solver.js — the same module the `--auto` entry point uses.
const { pageEval, recaptchaToken } = require('./solver.js');

const RECAPTCHA_KEY = '6LfwwhgpAAAAAJiItLCXBrm2UJpZe9xzFkaiXFiA';
const DASH = 'https://dashboard.cohere.com';
const OS_API = 'https://production.api.os.cohere.com';
const RPC = (host, method) => `${host}/rpc/BlobheartAPI/${method}`;

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const flag = (name) => args.includes(`--${name}`);

/** In-page JSON fetch: same origin, cookies included, CORS as the SPA sees it. */
function pageFetch(cdp, sid, url, { method = 'POST', headers = {}, body = null, timeoutMs = 60000 } = {}) {
  const expr = `(() => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ${timeoutMs});
  return fetch(${JSON.stringify(url)}, {
    method: ${JSON.stringify(method)},
    headers: ${JSON.stringify({ accept: 'application/json', ...headers })},
    body: ${body === null ? 'null' : JSON.stringify(JSON.stringify(body))},
    credentials: 'include',
    signal: ctl.signal,
  }).then(async (r) => {
    clearTimeout(t);
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: r.status, text: text.slice(0, 4000), json, url: r.url };
  }).catch((e) => ({ status: null, error: String(e), url: ${JSON.stringify(url)} }));
})()`;
  return pageEval(cdp, sid, expr);
}

/**
 * One account on the light path.
 * ctx = {address, token, mailPort, proxy, runDir, rpcHost}
 */
async function runLight(cdp, sid, ctx) {
  const { address, token, mailPort, proxy, runDir } = ctx;
  const rpcHost = ctx.rpcHost || OS_API;
  const result = { ok: false, address, key: null, error: null, stage: 'start', password: ctx.password || flow.makePassword() };
  const log = (m) => lib.log('light', `${result.stage}: ${m}`);
  const save = (obj) => fs.writeFileSync(path.join(runDir, 'light.json'), JSON.stringify(obj, null, 2));

  try {
    // ---- land on the register page; block the SPA payload, keep the SSR HTML
    result.stage = 'landing';
    await cdp.send('Network.setBlockedURLs', { urls: ['*/_next/static/chunks/*', '*.js.map', '*hot-update*'] }, sid).catch(() => {});
    let landed = false;
    for (let i = 0; i < 3 && !landed; i++) {
      await flow.goto(cdp, sid, `${DASH}/welcome/register?email=${encodeURIComponent(address)}`, { label: `light-register#${i + 1}` });
      const state = await flow.pageState(cdp, sid).catch(() => null);
      const url = state && state.url ? state.url : '';
      const hasForm = !!(state && state.inputs && state.inputs.some((x) => /email/i.test(x.type || '')));
      log(`landing try ${i + 1}: url=${url} inputs=${state && state.inputs ? state.inputs.length : '?'} hasForm=${hasForm}`);
      if (hasForm || (/dashboard\.cohere\.com\/welcome/.test(url) && !/chrome-error/.test(url))) {
        landed = true;
        break;
      }
      if (/chrome-error/.test(url)) {
        // the tunnel died mid-navigation: give the context one more shot
        await lib.sleep(1500);
      }
    }
    const state = await flow.dump(cdp, sid, runDir, 'L1-register');
    if (!landed) throw Object.assign(new Error('landing failed (exit dropped the page)'), { stage: 'landing', exitRetry: true });
    log(`landed: title="${state.title}" inputs=${state.inputs ? state.inputs.length : '?'} url=${state.url}`);

    // ---- reCAPTCHA Enterprise token for the 'register' action
    result.stage = 'recaptcha';
    const recToken = await recaptchaToken(cdp, sid, 'register');
    log(`token ${String(recToken).slice(0, 12)}… (${String(recToken).length} chars)`);

    // ---- registration POST (same call the SPA makes, headers included)
    result.stage = 'register';
    const body = {
      email: address,
      password: result.password,
      inviteHash: '',
      freeCreditCode: '',
      analyticsData: {},
    };
    const headers = {
      'content-type': 'application/json',
      authorization: 'Bearer',
      'Request-Source': 'playground',
      'X-Recaptcha-Token': recToken,
      'X-Email-Domain': address.includes('@') ? address.split('@')[1] : address,
    };
    let reg = await pageFetch(cdp, sid, RPC(rpcHost, 'RegisterWithEmail'), { method: 'POST', headers, body });
    log(`RegisterWithEmail -> ${reg.status} ${String(JSON.stringify(reg.json || reg.text || reg.error || '')).slice(0, 300)}`);
    if (!reg.status || reg.status >= 400) {
      const alt = await pageFetch(cdp, sid, RPC(DASH, 'RegisterWithEmail'), { method: 'POST', headers, body });
      log(`(dashboard host) RegisterWithEmail -> ${alt.status} ${String(JSON.stringify(alt.json || alt.text || alt.error || '')).slice(0, 300)}`);
      if (alt.status && alt.status < 400) reg = alt;
    }
    save({ stage: 'register', reg, password: result.password, address, exit: proxy && proxy.raw });
    if (!reg.status || reg.status >= 400) {
      // the in-page POST failed at the transport level (exit dropped) or was
      // rejected: retry the same call from Node with exit rotation, same token
      const rpc = require('./rpc');
      const nodeReg = await rpc.call('RegisterWithEmail', body, {
        tries: 6,
        headers: { 'X-Recaptcha-Token': recToken, 'X-Email-Domain': headers['X-Email-Domain'] },
      });
      log(`node RegisterWithEmail -> ${nodeReg.status} ${String(JSON.stringify(nodeReg.json || nodeReg.text || nodeReg.error || '')).slice(0, 300)}`);
      save({ stage: 'register-node', nodeReg, exit: nodeReg.proxy });
      if (nodeReg.status && nodeReg.status < 400) reg = { status: nodeReg.status, json: nodeReg.json, text: nodeReg.text };
    }
    if (!reg.status || reg.status >= 400) {
      result.error = `register ${reg.status}: ${String(JSON.stringify(reg.json || reg.text || reg.error || '')).slice(0, 200)}`;
      result.exitRetry = !reg.status; // network-level failure: another exit may carry it
      return result;
    }

    // ---- from here on the browser is not needed: mail, confirm, bearer, key
    if (ctx.registerOnly) {
      result.ok = true;
      result.stage = 'registered';
      return result;
    }
    result.stage = 'post';
    const post = await require('./post').finishAccount({
      email: address,
      password: result.password,
      mailPort,
      token,
      runDir,
      log: (m) => lib.log('light', m),
    });
    fs.writeFileSync(path.join(runDir, 'post.json'), JSON.stringify(post, null, 2));
    if (!post.ok) {
      result.error = `post: ${post.error}`;
      return result;
    }
    const v = await flow.verifyKey(proxy, post.key);
    lib.log('light', `verify ${String(post.key).slice(0, 6)}… -> ${JSON.stringify(v).slice(0, 200)}`);
    if (v.ok) {
      result.ok = true;
      result.key = post.key;
      result.verify = v;
      return result;
    }
    result.error = `key returned but failed live verify: ${JSON.stringify(v).slice(0, 160)}`;
    return result;
  } catch (e) {
    if (e && e.stage) result.stage = e.stage;
    if (e && e.exitRetry) result.exitRetry = true;
    result.error = `${result.stage}: ${e.message}`;
    return result;
  } finally {
    try {
      save(result);
    } catch (e) {}
  }
}

/** Finds the first cohere-looking key anywhere in an RPC JSON response. */
function findKeyDeep(obj, depth = 0) {
  if (obj === null || obj === undefined || depth > 6) return null;
  if (typeof obj === 'string') return /^[A-Za-z0-9]{38,48}$/.test(obj) && /[A-Za-z]/.test(obj) && /[0-9]/.test(obj) ? obj : null;
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const hit = findKeyDeep(v, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const hit = findKeyDeep(obj[k], depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/** True for addresses that are ours or unroutable: never acceptable as an exit. */
function isPublicIp(ip) {
  const m = String(ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 192 && b === 168) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 169 && b === 254) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  return true;
}

/**
 * Proves the browser really exits through the proxy: three echo services, first
 * public answer wins. A CGNAT/private answer means a transparent relay handed
 * us our own address, which must never reach the target.
 */
async function egressCheck(cdp, sid) {
  const probes = [
    `fetch('https://api.ipify.org/?format=json').then(r=>r.json()).then(j=>j.ip)`,
    `fetch('https://api.myip.com').then(r=>r.json()).then(j=>j.ip)`,
    `fetch('https://ifconfig.me/ip').then(r=>r.text())`,
  ];
  for (const expr of probes) {
    try {
      const ip = await B.evalJs(cdp, sid, expr, { awaitPromise: true });
      const s = typeof ip === 'string' ? ip.trim() : '';
      if (isPublicIp(s)) return s;
      lib.log('light', `egress probe returned ${JSON.stringify(ip)} (not a public ip)`);
    } catch (e) {}
  }
  return null;
}

module.exports = { runLight, recaptchaToken, pageFetch, pageEval, findKeyDeep, RPC, DASH, OS_API, RECAPTCHA_KEY, egressCheck, isPublicIp };

// ---------------------------------------------------------------- CLI usage
if (require.main === module) {
  (async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const RUN_DIR = path.join(lib.ROOT, 'out', `light-${stamp}`);
    fs.mkdirSync(RUN_DIR, { recursive: true });
    const PORT = parseInt(opt('port', '9350'), 10);
    const MAIL_PORT = parseInt(opt('mail', '9700'), 10);
    const HEADLESS = flag('headless');
    const KEEP = flag('keep');
    const BYPASS = flag('bypass-google')
      ? ['www.google.com', 'www.gstatic.com', 'recaptcha.net', '*.google.com', '*.gstatic.com', '*.recaptcha.net'].join(',')
      : null;

    const exits = (() => {
      if (opt('exit')) return [lib.parseProxy(opt('exit'))];
      const rows = [];
      const push = (raw, rank) => {
        if (raw) rows.push({ raw: raw.trim(), rank });
      };
      // live-exits rows carry cohereMs/googleMs — Google reachability is what
      // the reCAPTCHA bootstrap needs, so those rank first
      try {
        for (const l of fs.readFileSync(path.join(lib.OUT, 'live-exits.txt'), 'utf8').split(/\r?\n/)) {
          const [raw, cohere, google] = l.split('\t');
          if (!raw) continue;
          const g = Number(google);
          push(raw, (g > 0 ? 0 : 100000) + (+cohere || 99999) + (g > 0 ? g : 0));
        }
      } catch (e) {}
      for (const f of ['warm-exits.txt', 'router-cohere-live.txt', 'good-exits.txt', '../../out/router-cohere-live.txt']) {
        try {
          for (const l of fs.readFileSync(path.join(lib.OUT, f), 'utf8').split(/\r?\n/)) push(l.split('\t')[0], 5000);
        } catch (e) {}
      }
      rows.sort((a, b) => a.rank - b.rank);
      return [...new Set(rows.map((r) => r.raw))].map((r) => lib.parseProxy(r)).filter(Boolean);
    })();
    lib.log('light', `run dir ${RUN_DIR}; ${exits.length} candidate exits`);
    const rc = await recaptcha.ensure({ log: (m) => lib.log('light', m) }).catch((e) => ({ ok: false, error: e.message }));
    lib.log('light', `recaptcha cache: ${JSON.stringify(rc)}`);

    const box = await lib.brokerCreate(MAIL_PORT);
    lib.log('light', `mailbox ${box.address} (broker ${box.port || MAIL_PORT})`);

    const chrome = B.launchChrome(PORT, 'light', { headless: HEADLESS });
    const cdp = await B.connect(PORT);
    try {
      let chosen = null;
      for (const proxy of exits.slice(0, 8)) {
        let ctx = null;
        let teardown = null;
        let cacheTeardown = null;
        try {
          ctx = await B.openContext(cdp, BYPASS ? { proxyServer: lib.proxyLib.browserUrl(proxy), proxyBypassList: BYPASS } : { proxyServer: lib.proxyLib.browserUrl(proxy) });
          if (proxy.username) teardown = await lib.proxyLib.attachProxyAuth(cdp, ctx.sessionId, proxy);
          cacheTeardown = await recaptcha.install(cdp, ctx.sessionId, { log: (m) => lib.log('light', m) }).catch(() => null);
          const ip = await egressCheck(cdp, ctx.sessionId);
          lib.log('light', `exit ${proxy.raw} -> ip ${ip || 'unverified'}`);
          if (!ip) throw new Error('egress check failed (no public ip through this exit)');
          chosen = { proxy, ctx, teardown };
          break;
        } catch (e) {
          lib.log('light', `exit ${proxy.raw} unusable: ${e.message}`);
          try {
            if (cacheTeardown) await cacheTeardown();
          } catch (err) {}
          try {
            if (teardown) await teardown();
          } catch (err) {}
          try {
            if (ctx) await cdp.disposeBrowserContext(ctx.browserContextId);
          } catch (err) {}
        }
      }
      if (!chosen) throw new Error('no candidate exit carried the browser');

      const res = await runLight(cdp, chosen.ctx.sessionId, {
        address: box.address,
        token: box.token,
        mailPort: box.port || MAIL_PORT,
        proxy: chosen.proxy,
        runDir: RUN_DIR,
      });
      lib.log('light', `RESULT ok=${res.ok} stage=${res.stage} key=${res.key ? res.key.slice(0, 6) + '…' + res.key.slice(-4) : 'none'} err=${res.error || ''}`);
      if (res.ok) {
        lib.appendKey(res.key, { address: box.address, proxy: chosen.proxy.raw, via: 'light' });
        const accountsFile = path.join(lib.ROOT, 'accounts.json');
        const accounts = lib.loadJson(accountsFile, []);
        accounts.push({ address: box.address, password: res.password, key: res.key, proxy: chosen.proxy.raw, at: lib.stamp() });
        lib.saveJson(accountsFile, accounts);
      }
    } finally {
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
    lib.log('light', `FAIL ${e.stack}`);
    process.exit(1);
  });
}
