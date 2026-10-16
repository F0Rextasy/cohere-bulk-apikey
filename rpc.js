'use strict';
// Node-side Blobheart RPC client: plain JSON POST to
// https://production.api.os.cohere.com/rpc/BlobheartAPI/<Method>, rotating
// through exits with per-request retries. This is the same surface the
// dashboard SPA calls; it authenticates with `Authorization: Bearer <token>`.

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const OS_API = 'https://production.api.os.cohere.com';
const RPC = (method, host = OS_API) => `${host}/rpc/BlobheartAPI/${method}`;

/** Proxy pool: warm first, then live (google-capable first), then router/good. */
function exits() {
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
    const [raw, cohere] = l.split('\t');
    push(raw, 1000 + (+cohere || 99999));
  }
  for (const l of readTabbed('warm-exits.txt')) {
    const [raw, hits, rounds] = l.split('\t');
    push(raw, 10 + (Number(rounds) - Number(hits)) * 100);
  }
  for (const f of ['router-cohere-live.txt', '../../out/router-cohere-live.txt']) {
    for (const l of readTabbed(f)) push(l.split('\t')[0], 500);
  }
  for (const l of readTabbed('good-exits.txt')) push(l.split('\t')[0], 300);
  rows.sort((a, b) => a.rank - b.rank);
  return [...new Set(rows.map((r) => r.raw))].map((r) => lib.parseProxy(r)).filter(Boolean);
}

let POOL = null;
function pool() {
  if (!POOL || !POOL.length) POOL = exits();
  return POOL;
}

/**
 * One RPC call. Retries across exits (default 8) and returns
 * { status, json, text, proxy } or { status: null, error }.
 */
async function call(method, body = {}, { token = null, headers = {}, tries = 8, timeoutMs = 40000, needStatus = true } = {}) {
  const h = {
    'content-type': 'application/json',
    authorization: `Bearer ${token || ''}`,
    'Request-Source': 'playground',
    origin: 'https://dashboard.cohere.com',
    referer: 'https://dashboard.cohere.com/',
    ...headers,
  };
  const list = pool();
  if (!list.length) throw new Error('no exits available for rpc call');
  const start = Math.floor(Math.random() * list.length);
  let lastErr = null;
  for (let i = 0; i < Math.min(tries, list.length); i++) {
    const proxy = list[(start + i) % list.length];
    try {
      const r = await lib.request(proxy, { method: 'POST', url: RPC(method), headers: h, body, timeoutMs });
      if (needStatus && r.status >= 500) {
        lastErr = new Error(`${r.status} ${method}`);
        continue;
      }
      let json = r.json;
      if (!json && r.text) {
        try {
          json = JSON.parse(r.text);
        } catch (e) {}
      }
      return { status: r.status, json, text: r.text.slice(0, 2000), proxy: proxy.raw };
    } catch (e) {
      lastErr = e;
    }
  }
  return { status: null, error: lastErr ? lastErr.message : 'unreachable' };
}

module.exports = { call, exits, pool, RPC, OS_API, resetPool: () => (POOL = null) };
