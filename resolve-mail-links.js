'use strict';
// Resolves every SendGrid click-tracking URL in a stored mail body and prints
// the real destinations, then optionally follows the confirm-email chain.
//   node resolve-mail-links.js --mail=out/finish-5812-.../mail.json
// Offline input, network = sendgrid/dashboard direct first.

const fs = require('fs');
const lib = require('./lib');
const post = require('./post');

const args = process.argv.slice(2);
const opt = (n, d) => {
  const h = args.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split('=').slice(1).join('=') : d;
};

const MAIL = opt('mail');
const json = JSON.parse(fs.readFileSync(MAIL, 'utf8'));
const blob = `${json.html_body || ''}\n${json.text_body || ''}\n${json.html || ''}\n${json.text || ''}`;
const urls = [...new Set(blob.match(/https?:\/\/[^\s"'<>)\]]+/g) || [])];
const tracking = urls.filter((u) => /sendgrid\.net/i.test(u));

(async () => {
  lib.log('resolve-links', `${MAIL}: ${urls.length} urls, ${tracking.length} tracking`);
  for (const u of tracking) {
    try {
      const g = await post.noFollowGet(u);
      const loc = (g.location || '').replace(/&amp;/g, '&');
      lib.log('resolve-links', `${g.status} ${u.slice(0, 90)}… -> ${loc ? loc.slice(0, 160) : 'NO LOCATION'}`);
      if (/dashboard\.cohere\.com\/confirm-email/i.test(loc)) {
        fs.writeFileSync('out/finish-link-resolved.txt', loc);
        lib.log('resolve-links', `CONFIRM LINK: ${loc}`);
      }
    } catch (e) {
      lib.log('resolve-links', `ERR ${e.message} ${u.slice(0, 70)}`);
    }
    await lib.sleep(400);
  }
})().catch((e) => {
  lib.log('resolve-links', `FAIL ${e.stack}`);
  process.exit(1);
});
