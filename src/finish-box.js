'use strict';
// Finishes a registered Cohere account from Node: read the newest message body
// out of a Mailtrap inbox (the broker's /list only carries the envelope, so the
// body needs Mailtrap's own message endpoints), pull the verification link, then
// run the confirm -> bearer -> trial-key pipeline.
//
//   node src/finish-box.js --inbox=<box-id> --email=<inbox> --password=<pw>
//
// Mailtrap is our own inbox provider, not the target, so this may talk to it
// directly (with retries — the first connects from this line are blackholed);
// the cohere calls inside post.js stay on the proxy pool.

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const lib = require('./lib');
const post = require('./post');
const verify = require('./verify');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const INBOX = opt('inbox');
const EMAIL = opt('email');
const PASSWORD = opt('password');
const SLOT = opt('slot', ''); // optional run dir slot

const TOKEN = fs.readFileSync(path.join(os.homedir(), '.river-mailtrap-token'), 'utf8').trim();

function getOnce(url, { family, proxy, raw } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        host: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'GET',
        family,
        headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/json, text/plain, */*' },
        agent: proxy ? lib.proxyLib.createAgent(proxy) : undefined,
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers, raw }));
      }
    );
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/** direct (retry) then pool; returns {status, text, via} */
async function get(url) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await getOnce(url, { family: 4 });
      if (r.status === 200) return { ...r, via: 'direct' };
      if (r.status === 404) return { ...r, via: 'direct' };
    } catch (e) {}
    await lib.sleep(1200);
  }
  const pool = lib.loadProxies(path.join(lib.ROOT, 'out', 'live-exits.txt'));
  for (const p of pool.slice(0, 12)) {
    try {
      const r = await getOnce(url, { proxy: p });
      if (r.status === 200) return { ...r, via: p.raw };
      if (r.status === 404) return { ...r, via: p.raw };
    } catch (e) {}
  }
  return { status: null, text: '', via: 'unreachable' };
}

function json(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

(async () => {
  if (!INBOX || !EMAIL) throw new Error('usage: node src/finish-box.js --inbox=<mailtrap inbox id> --email=<address> [--password=…]');

  // 1) newest messages
  const list = await get(`https://mailtrap.io/api/inbound/inboxes/${INBOX}/messages`);
  const msgs = json(list.text);
  const arr = Array.isArray(msgs) ? msgs : (msgs && msgs.data) || [];
  lib.log('finish-box', `inbox ${INBOX}: ${arr.length} message(s) [${list.via}]`);
  if (!arr.length) {
    lib.log('finish-box', `no messages yet — nothing to finish`);
    return;
  }
  const msg = arr[0];
  const msgId = msg.id;

  // 2) body (the /messages item often has empty text/html; the body endpoints do not)
  let blob = `${msg.subject || ''}\n${msg.text || ''}\n${msg.html || ''}`;
  for (const suffix of ['/body.txt', '/body.html', '' ]) {
    if (/https?:\/\//.test(blob)) break; // only stop once an actual URL is in hand
    const r = await get(`https://mailtrap.io/api/inbound/inboxes/${INBOX}/messages/${msgId}${suffix}`);
    if (r.status !== 200) continue;
    const j = suffix === '' ? json(r.text) : null;
    if (j) {
      const t = (j.raw_text_body || j.text_body || j.raw_html_body || j.html_body || '');
      blob += `\n${t}`;
    } else {
      blob += `\n${r.text}`;
    }
    lib.log('finish-box', `fetched ${suffix || 'message'} (${r.text.length} bytes) [${r.via}]`);
  }

  const links = (blob.match(/https?:\/\/[^\s"'<>)\]]+/g) || []).map((u) => u.replace(/&amp;/g, '&'));
  let link = links.find((u) => /confirm|verify|activate|token|welcome/i.test(u) && !/sendgrid|tracking/i.test(u)) || null;
  if (!link) {
    // Cohere wraps every mail URL in SendGrid click-tracking; the real target is
    // only visible by asking sendgrid for its redirect (no need to follow it).
    const uniq = [...new Set(links)].filter((u) => /sendgrid|mailgun|mandrill|tracking/i.test(u) || !/cohere\.com/i.test(u));
    lib.log('finish-box', `resolving ${uniq.length} tracking link(s) for their real target`);
    for (const u of uniq.slice(0, 20)) {
      try {
        const r = await getOnce(u, { family: 4 });
        const loc = (r.headers && r.headers.location) || '';
        if (loc) lib.log('finish-box', `  ${u.slice(0, 60)}… -> ${loc.slice(0, 140)}`);
        if (/cohere\.com/i.test(loc) && /confirm|verify|activate|token|welcome|register/i.test(loc)) {
          link = loc;
          break;
        }
        if (!link && /cohere\.com/i.test(loc) && !/\.(png|jpg|css|js|ico)/i.test(loc)) link = loc;
      } catch (e) {}
    }
  }
  lib.log('finish-box', `subject "${String(msg.subject).slice(0, 60)}" links=${links.length} link=${link ? link.slice(0, 160) : 'NONE'}`);
  if (!link) {
    lib.log('finish-box', `no verification link in the message — body dump kept in out/finish-box-raw.txt`);
    fs.writeFileSync(path.join(lib.OUT, 'finish-box-raw.txt'), blob);
    return;
  }

  const runDir = SLOT ? path.dirname(SLOT) : path.join(lib.OUT, `finish-${INBOX}`);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'mail-link.json'), JSON.stringify({ inbox: INBOX, msgId, subject: msg.subject, link }, null, 2));

  const fin = await post.finishAccount({ email: EMAIL, password: PASSWORD, mailPort: 9700, token: String(INBOX), link, runDir, log: (m) => lib.log('finish-box', m) });
  lib.saveJson(path.join(runDir, 'finish.json'), fin);
  if (!fin.ok) {
    lib.log('finish-box', `finish failed: ${fin.error}`);
    return;
  }
  const v = await verify.verifyAny(fin.key).catch((e) => ({ ok: false, err: e.message }));
  lib.log('finish-box', `verify: ${JSON.stringify(v).slice(0, 200)}`);
  if (v.ok) {
    const fresh = lib.appendKey(fin.key, { address: EMAIL, proxy: null, via: 'finish-box' });
    const accounts = path.join(lib.ROOT, 'accounts.json');
    const a = lib.loadJson(accounts, []);
    a.push({ address: EMAIL, password: PASSWORD, key: fin.key, proxy: null, at: lib.stamp() });
    lib.saveJson(accounts, a);
    lib.log('finish-box', `KEY ${fin.key.slice(0, 6)}…${fin.key.slice(-4)} ${fresh ? 'stored' : 'dupe'} — keys.txt now has ${lib.loadJson(path.join(lib.ROOT, 'keys.txt'), null) === null ? '' : ''}entries: ${(fs.readFileSync(path.join(lib.ROOT, 'keys.txt'), 'utf8').trim().split(/\r?\n/).filter(Boolean)).length}`);
  } else {
    fs.appendFileSync(path.join(lib.OUT, 'unverified-keys.txt'), `${fin.key}\t${EMAIL}\t${JSON.stringify(v).slice(0, 140)}\n`);
    lib.log('finish-box', `key ${fin.key.slice(0, 6)}… could not be live-verified; saved to unverified-keys.txt`);
  }
})().catch((e) => {
  lib.log('finish-box', `FAIL ${e.stack}`);
  process.exit(1);
});
