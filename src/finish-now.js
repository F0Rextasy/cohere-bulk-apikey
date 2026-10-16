'use strict';
// Finishes one account with zero mailbox dependency: the confirm link was
// already extracted from stored mail evidence (Mailtrap messages vanish), so
// this runs the post chain (confirm -> bearer -> trial key -> live verify)
// and stores the key.
//
//   node src/finish-now.js --inbox=5812 --email=… --password=… --link="https://dashboard.cohere.com/confirm-email?token=…"
//   node src/finish-now.js --inbox=5812 --email=… --password=… --link-file=out/finish-link-5812.txt

const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const post = require('./post');
const verify = require('./verify');

const args = process.argv.slice(2);
const opt = (n, d) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split('=').slice(1).join('=') : d;
};

const INBOX = opt('inbox');
const EMAIL = opt('email');
const PASSWORD = opt('password');
let LINK = opt('link', null);
const LINK_FILE = opt('link-file', null);
if (!LINK && LINK_FILE) LINK = fs.readFileSync(LINK_FILE, 'utf8').trim().replace(/["'([\]]+$/, '');
if (!INBOX || !EMAIL || !PASSWORD || !LINK) throw new Error('usage: node src/finish-now.js --inbox=<id> --email=<addr> --password=<pw> [--link=… | --link-file=…]');

const RUN = path.join(lib.OUT, `finish-now-${INBOX}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(RUN, { recursive: true });

(async () => {
  const say = (m) => lib.log('finish-now', `${EMAIL}: ${m}`);
  say(`link=${LINK.slice(0, 140)}`);
  const fin = await post.finishAccount({ email: EMAIL, password: PASSWORD, mailPort: 9700, token: String(INBOX), link: LINK, runDir: RUN, log: say });
  lib.saveJson(path.join(RUN, 'finish.json'), fin);
  say(`finish ok=${fin.ok} err=${fin.error || ''} key=${fin.key ? `${fin.key.slice(0, 6)}…` : 'none'}`);
  if (!fin.ok) process.exit(2);

  const v = await verify.verifyAny(fin.key).catch((e) => ({ ok: false, err: e.message }));
  lib.saveJson(path.join(RUN, 'verify.json'), v);
  say(`verify ${JSON.stringify(v).slice(0, 240)}`);
  if (!v.ok) {
    fs.appendFileSync(path.join(lib.OUT, 'unverified-keys.txt'), `${fin.key}\t${EMAIL}\t${JSON.stringify(v).slice(0, 140)}\n`);
    say('key unverified — appended to unverified-keys.txt');
    process.exit(3);
  }
  const fresh = lib.appendKey(fin.key, { address: EMAIL, proxy: v.proxy || null, via: 'finish-now' });
  const af = path.join(lib.ROOT, 'accounts.json');
  const arr = lib.loadJson(af, []);
  arr.push({ address: EMAIL, password: PASSWORD, key: fin.key, proxy: v.proxy || null, at: lib.stamp() });
  lib.saveJson(af, arr);
  const total = fs.readFileSync(path.join(lib.ROOT, 'keys.txt'), 'utf8').split(/\r?\n/).filter(Boolean).length;
  say(`KEY ${fin.key.slice(0, 6)}…${fin.key.slice(-4)} ${fresh ? 'stored' : 'dupe'} — keys.txt now ${total} line(s)`);
})().catch((e) => {
  lib.log('finish-now', `FAIL ${e.stack}`);
  process.exit(1);
});
