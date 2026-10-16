'use strict';
// Recon: fetch Cohere dashboard register page + its JS chunks through a live
// pool exit and pull out API endpoints / form field names / captcha markers.
//   node recon.js [--proxy=line] [--save=dir]

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

function liveCandidates() {
  const f = path.join(lib.ROOT, 'out', 'live-exits.txt');
  const list = [];
  if (fs.existsSync(f)) {
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const raw = l.split('\t')[0].trim();
      if (raw) list.push(lib.proxyLib.parseProxy(raw));
    }
  }
  return list.filter(Boolean).sort(() => Math.random() - 0.5);
}

(async () => {
  const cands = opt('proxy') ? [lib.proxyLib.parseProxy(opt('proxy'))] : liveCandidates();
  if (!cands.length) throw new Error('no live proxy yet; wait for probe.js');
  const saveDir = opt('save', path.join(lib.OUT, 'recon'));
  fs.mkdirSync(saveDir, { recursive: true });

  let proxy = null;
  let page = null;
  for (const p of cands.slice(0, 8)) {
    try {
      page = await lib.request(p, {
        url: 'https://dashboard.cohere.com/welcome/register?email=probe%40example.com',
        timeoutMs: 45000,
        headers: { accept: 'text/html' },
      });
      proxy = p;
      break;
    } catch (e) {
      lib.log('recon', `${p.raw} failed: ${e.message}`);
    }
  }
  if (!proxy) throw new Error('no candidate carried the request');
  lib.log('recon', `via ${proxy.raw}`);
  lib.log('recon', `register page -> ${page.status} (${page.text.length} bytes)`);
  fs.writeFileSync(path.join(saveDir, 'register.html'), page.text);

  const buildId = (page.text.match(/"buildId":"([^"]+)"/) || [])[1];
  lib.log('recon', `buildId=${buildId}`);

  const chunks = [...new Set([...page.text.matchAll(/\/_next\/static\/chunks\/[^"'\\\s]+\.js/g)].map((m) => m[0]))];
  lib.log('recon', `chunks in page: ${chunks.length}`);

  // The register flow chunk, plus _app (recaptcha key etc.)
  const wanted = chunks.filter((c) => /welcome|auth|register|login|app-|main/i.test(c));
  const endpoints = new Map();
  const notes = [];
  for (const c of wanted.slice(0, 14)) {
    let res = null;
    for (const p of [proxy, ...cands.slice(0, 10)]) {
      try {
        res = await lib.request(p, { url: 'https://dashboard.cohere.com' + c, timeoutMs: 45000 });
        if (res.status === 200 && res.text.length > 1000) {
          lib.log('recon', `chunk ${path.basename(c)} via ${p.raw} ${res.text.length} bytes`);
          break;
        }
        res = null;
      } catch (e) {
        res = null;
      }
    }
    if (!res) {
      lib.log('recon', `chunk ${c} unreachable this round`);
      continue;
    }
    fs.writeFileSync(path.join(saveDir, path.basename(c)), res.text);
    const body = res.text;
    for (const m of body.matchAll(/["'`](\/(?:api|v1|dashboard|auth)[A-Za-z0-9_\-./]{2,80})["'`]/g)) {
      endpoints.set(m[1], (endpoints.get(m[1]) || 0) + 1);
    }
    for (const m of body.matchAll(/https:\/\/[a-z0-9.\-]*cohere[a-z0-9.\-]*(?:\/[A-Za-z0-9_\-./]{2,80})?/gi)) {
      endpoints.set(m[0], (endpoints.get(m[0]) || 0) + 1);
    }
    if (/recaptcha/i.test(body)) {
      const key = (body.match(/site_key["']?\s*[:=]\s*["']([A-Za-z0-9_\-]{30,})/) || [])[1];
      notes.push(`chunk ${path.basename(c)}: recaptcha${key ? ` siteKey=${key}` : ''}`);
    }
    if (/confirm/i.test(body)) notes.push(`chunk ${path.basename(c)}: mentions confirm`);
    lib.log('recon', `chunk ${path.basename(c)} ${res.text.length} bytes`);
  }

  const list = [...endpoints.entries()].sort((a, b) => b[1] - a[1]);
  fs.writeFileSync(path.join(saveDir, 'endpoints.json'), JSON.stringify(list, null, 2));
  lib.log('recon', `endpoints:\n` + list.slice(0, 60).map(([k, v]) => `  ${v}× ${k}`).join('\n'));
  for (const n of notes) lib.log('recon', `note: ${n}`);
})().catch((e) => {
  lib.log('recon', `FAIL ${e.stack}`);
  process.exit(1);
});
