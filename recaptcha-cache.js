'use strict';
// Local cache for Google's reCAPTCHA Enterprise assets.
//
// The recaptcha runtime (`www.gstatic.com/recaptcha/releases/<rel>/recaptcha__en.js`)
// is ~1 MB and free exits die long before it finishes downloading — the reason a
// browser register flow silently stalls with `grecaptcha` never defined. The file
// is versioned and immutable, so it is downloaded once through an exit, cached,
// and then served to every Chrome context via the Fetch domain (no own-IP
// traffic, no repeated 1 MB downloads).
//
//   node recaptcha-cache.js            # populate the cache through the pool

const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const rpc = require('./rpc');

const KEY = '6LfwwhgpAAAAAJiItLCXBrm2UJpZe9xzFkaiXFiA';
const CACHE_DIR = path.join(lib.OUT, 'cache', 'recaptcha');

function fileFor(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/recaptcha\/releases\/([^/]+)\//);
    if (m) return { file: path.join(CACHE_DIR, `${m[1]}__${path.basename(u.pathname)}`), release: m[1] };
    return { file: path.join(CACHE_DIR, path.basename(u.pathname) || 'recaptcha.js'), release: null };
  } catch (e) {
    return null;
  }
}

const ENT_TYPES = { js: 'application/javascript; charset=utf-8', html: 'text/html; charset=utf-8' };

/** Downloads anything not yet cached, through the proxy pool. */
async function ensure({ log = () => {} } = {}) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const bootstrapUrl = `https://www.google.com/recaptcha/enterprise.js?render=${KEY}&hl=en`;
  const bootstrap = fileFor('https://www.google.com/recaptcha/enterprise.js');
  let body = null;
  if (fs.existsSync(bootstrap.file)) {
    body = fs.readFileSync(bootstrap.file, 'utf8');
  } else {
    body = await fetchThroughPool(bootstrapUrl, { log });
    if (!body) return { ok: false, error: 'could not fetch enterprise.js' };
    fs.writeFileSync(bootstrap.file, body);
    log(`cached enterprise.js (${body.length} bytes)`);
  }
  const release = (body.match(/recaptcha\/releases\/([A-Za-z0-9_\-]+)\//) || [])[1];
  if (!release) return { ok: true, release: null, note: 'no release id in bootstrap' };
  const runtime = fileFor(`https://www.gstatic.com/recaptcha/releases/${release}/recaptcha__en.js`);
  if (!fs.existsSync(runtime.file) || fs.statSync(runtime.file).size < 50000) {
    const rb = await fetchThroughPool(`https://www.gstatic.com/recaptcha/releases/${release}/recaptcha__en.js`, { log });
    if (!rb || rb.length < 50000) return { ok: false, error: `runtime fetch failed (${rb ? rb.length : 0} bytes)` };
    fs.writeFileSync(runtime.file, rb);
    log(`cached runtime ${release} (${rb.length} bytes)`);
  } else {
    log(`runtime ${release} already cached (${fs.statSync(runtime.file).size} bytes)`);
  }
  fs.writeFileSync(path.join(CACHE_DIR, 'current.json'), JSON.stringify({ release, key: KEY, at: lib.stamp() }, null, 2));
  return { ok: true, release, runtime: runtime.file };
}

async function fetchThroughPool(url, { log = () => {} } = {}) {
  const pool = rpc.exits();
  for (const p of pool.slice(0, 12)) {
    try {
      const r = await lib.request(p, { url, timeoutMs: 60000, headers: { accept: '*/*' } });
      if (r.status === 200 && r.text.length > 500) {
        log(`fetched ${url.slice(0, 80)} via ${p.raw} (${r.text.length} bytes)`);
        return r.text;
      }
    } catch (e) {}
  }
  return null;
}

/**
 * Serves cached reCAPTCHA assets to a page. Returns an async teardown.
 * Uncached URLs keep flowing to the network (i.e. through the context's exit).
 */
async function install(cdp, sid, { log = () => {} } = {}) {
  let served = 0;
  const onPaused = async (p) => {
    const url = p.request.url;
    if (!/gstatic\.com\/recaptcha\/|google\.com\/recaptcha\/|recaptcha\.net\//.test(url)) {
      return cdp.send('Fetch.continueRequest', { requestId: p.requestId }, sid).catch(() => {});
    }
    const f = fileFor(url);
    if (f && fs.existsSync(f.file)) {
      const buf = fs.readFileSync(f.file);
      served++;
      if (served <= 3) log(`serving cached ${path.basename(f.file)} (${buf.length} bytes)`);
      return cdp
        .send(
          'Fetch.fulfillRequest',
          {
            requestId: p.requestId,
            responseCode: 200,
            responseHeaders: [
              { name: 'content-type', value: ENT_TYPES.js },
              { name: 'cache-control', value: 'public, max-age=86400' },
              { name: 'access-control-allow-origin', value: '*' },
            ],
            body: buf.toString('base64'),
          },
          sid
        )
        .catch(() => {});
    }
    return cdp.send('Fetch.continueRequest', { requestId: p.requestId }, sid).catch(() => {});
  };
  const off = cdp.on('Fetch.requestPaused', onPaused, sid);
  await cdp.send(
    'Fetch.enable',
    { patterns: [{ urlPattern: '*gstatic.com/recaptcha/*' }, { urlPattern: '*google.com/recaptcha/*' }, { urlPattern: '*recaptcha.net/*' }] },
    sid
  );
  log('reCAPTCHA asset interceptor armed');
  return async () => {
    off();
    try {
      await cdp.send('Fetch.disable', {}, sid);
    } catch (e) {}
    if (served) log(`served ${served} cached recaptcha assets`);
  };
}

module.exports = { ensure, install, CACHE_DIR, fileFor, KEY };

if (require.main === module) {
  (async () => {
    const r = await ensure({ log: (m) => lib.log('recaptcha-cache', m) });
    lib.log('recaptcha-cache', JSON.stringify(r));
  })().catch((e) => {
    lib.log('recaptcha-cache', `FAIL ${e.stack}`);
    process.exit(1);
  });
}
