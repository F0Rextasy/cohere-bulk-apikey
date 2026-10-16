'use strict';
// Node-only mint: no browser, no captcha, no page load.
//
//   node src/node-mint.js [--count=30] [--minutes=12] [--tries=8]
//
// Why this exists: `RegisterWithEmail` answers 200 even with an EMPTY
// X-Recaptcha-Token (probed), so if Mailtrap still receives the verification
// mail, the browser phase is dead weight — registration becomes one small POST.
// That makes the whole mint ~5 tiny requests per account instead of ~2.5 MB of
// Chrome payload, which is what the free pool can actually carry.
//
// Phase 1: create mailboxes and fire RegisterWithEmail for each (pipelined).
// Phase 2: poll every inbox every 20 s; as mail lands, confirm -> bearer ->
//          trial key -> live verify -> keys.txt.
//
// Resumable: state lives in out/node-mint-state.json; keys.txt is the record.

const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const rpc = require('./rpc');
const post = require('./post');
const verify = require('./verify');
const flow = require('./flow');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const COUNT = parseInt(opt('count', '30'), 10);
const MINUTES = parseFloat(opt('minutes', '12'));
const TRIES = parseInt(opt('tries', '8'), 10);
const MAIL_PORT = parseInt(opt('mail', '9700'), 10);
const RECAPTCHA = opt('recaptcha', 'empty'); // empty | none
const START = Date.now();
const STATE = path.join(lib.OUT, 'node-mint-state.json');
const RUN_DIR = path.join(lib.ROOT, 'out', `node-mint-${new Date().toISOString().replace(/[:.]/g, '-')}`);

function keysCount() {
  try {
    return fs.readFileSync(path.join(lib.ROOT, 'keys.txt'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
  } catch (e) {
    return 0;
  }
}

function log(m) {
  lib.log('node-mint', m);
}

/** Phase 1: one mailbox + one RegisterWithEmail per account. */
async function registerOne(idx, dir) {
  const box = await lib.brokerCreate(MAIL_PORT);
  const password = flow.makePassword();
  const headers = { 'X-Email-Domain': box.address.split('@')[1] };
  if (RECAPTCHA === 'empty') headers['X-Recaptcha-Token'] = '';
  const r = await rpc.call(
    'RegisterWithEmail',
    { email: box.address, password, inviteHash: '', freeCreditCode: '', analyticsData: {} },
    { headers, tries: TRIES }
  );
  const accepted = r.status === 200 || r.status === 201 || r.status === 204;
  log(`#${idx} register ${box.address} -> ${r.status} ${String(JSON.stringify(r.json || r.text || r.error || '')).slice(0, 160)}`);
  const rec = { idx, box, password, status: r.status, accepted, dir, at: lib.stamp() };
  lib.saveJson(path.join(dir, 'account.json'), { address: box.address, token: box.token, port: box.port, password, status: r.status, response: r.json || r.text || r.error || null });
  return rec;
}

(async () => {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const have = keysCount();
  log(`start: have ${have} keys, want ${COUNT} more; run dir ${RUN_DIR}`);

  // ---- phase 1
  const pending = [];
  for (let i = 1; i <= COUNT; i++) {
    const dir = path.join(RUN_DIR, `a${String(i).padStart(3, '0')}`);
    fs.mkdirSync(dir, { recursive: true });
    try {
      const rec = await registerOne(i, dir);
      if (rec.accepted) pending.push(rec);
    } catch (e) {
      log(`#${i} register failed: ${e.message}`);
    }
    lib.saveJson(STATE, { updated_at: new Date().toISOString(), phase: 'register', registered: pending.length, keys: keysCount(), run_dir: RUN_DIR });
    await lib.sleep(800 + Math.random() * 1200);
  }
  log(`phase 1 done: ${pending.length}/${COUNT} accepted`);

  // ---- phase 2: poll all inboxes, finish accounts as mail lands
  const done = new Set();
  const deadline = Date.now() + MINUTES * 60000;
  while (pending.some((p) => !done.has(p.idx)) && Date.now() < deadline) {
    for (const rec of pending) {
      if (done.has(rec.idx)) continue;
      let msgs = [];
      try {
        const mail = await lib.brokerList(rec.box.port || MAIL_PORT, rec.box.token);
        msgs = Array.isArray(mail) ? mail : (mail && mail.messages) || [];
      } catch (e) {
        continue;
      }
      if (!msgs.length) continue;
      done.add(rec.idx);
      const full = msgs[0];
      let blob = `${full.subject || ''}\n${full.text || ''}\n${full.html || ''}`;
      if (!full.text && !full.html && full.id) {
        try {
          const one = await lib.brokerRead(rec.box.port || MAIL_PORT, rec.box.token, full.id);
          blob = `${one.subject || ''}\n${one.text || ''}\n${one.html || ''}`;
        } catch (e) {}
      }
      const urls = [...new Set(blob.match(/https?:\/\/[^\s"'<>)\]]+/g) || [])];
      let link = urls.find((u) => /cohere\.(com|ai)/i.test(u) && /confirm|verify|activate/i.test(u)) || null;
      if (!link) link = await post.resolveTracking(urls, { log: (m) => log(`#${rec.idx} ${m}`) });
      log(`#${rec.idx} mail "${String(full.subject).slice(0, 60)}" urls=${urls.length} link=${link ? link.slice(0, 120) : 'NONE'}`);
      lib.saveJson(path.join(rec.dir, 'mail.json'), { subject: full.subject, link: link || null, blob: blob.slice(0, 4000) });
      if (!link) continue;
      try {
        const fin = await post.finishAccount({
          email: rec.box.address,
          password: rec.password,
          mailPort: rec.box.port || MAIL_PORT,
          token: rec.box.token,
          link,
          runDir: rec.dir,
          log: (m) => log(`#${rec.idx} ${m}`),
        });
        lib.saveJson(path.join(rec.dir, 'finish.json'), fin);
        if (fin.ok) {
          const v = await verify.verifyAny(fin.key).catch((e) => ({ ok: false, err: e.message }));
          if (v.ok) {
            const fresh = lib.appendKey(fin.key, { address: rec.box.address, proxy: null, via: 'node-mint' });
            const accounts = path.join(lib.ROOT, 'accounts.json');
            const arr = lib.loadJson(accounts, []);
            arr.push({ address: rec.box.address, password: rec.password, key: fin.key, proxy: null, at: lib.stamp() });
            lib.saveJson(accounts, arr);
            log(`KEY ${fin.key.slice(0, 6)}…${fin.key.slice(-4)} ${fresh ? 'stored' : 'dupe'} — total ${keysCount()}`);
          } else {
            const unv = path.join(lib.OUT, 'unverified-keys.txt');
            fs.appendFileSync(unv, `${fin.key}\t${rec.box.address}\tverify=${JSON.stringify(v).slice(0, 120)}\n`);
            log(`#${rec.idx} key ${fin.key.slice(0, 6)}… could not be live-verified: ${JSON.stringify(v).slice(0, 140)} (saved to unverified-keys.txt)`);
          }
        } else {
          log(`#${rec.idx} finish failed: ${fin.error}`);
        }
      } catch (e) {
        log(`#${rec.idx} finish threw: ${e.message}`);
      }
      lib.saveJson(STATE, { updated_at: new Date().toISOString(), phase: 'finish', registered: pending.length, finished: done.size, keys: keysCount(), run_dir: RUN_DIR });
    }
    await lib.sleep(15000);
  }
  log(`done: ${done.size}/${pending.length} processed, ${keysCount()} keys total, ${Math.round((Date.now() - START) / 1000)}s`);
})().catch((e) => {
  log(`FAIL ${e.stack}`);
  process.exit(1);
});
