'use strict';
// Decisive test for Cohere:
//   1) is the reCAPTCHA token actually enforced server-side on RegisterWithEmail?
//      (the endpoint probe answered 200 with an EMPTY token; if mail still lands,
//      the browser phase can be dropped entirely and registration becomes a
//      two-call Node flow)
//   2) does Mailtrap deliver Cohere's verification mail to a cohere-bulk box?
//
//   node delivery-test.js [--minutes=8]

const lib = require('./lib');
const rpc = require('./rpc');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const MINUTES = parseFloat(opt('minutes', '8'));

(async () => {
  const box = await lib.brokerCreate(9700);
  const password = 'Qv7#mK2pLw9tZr';
  lib.log('delivery-test', `box ${box.address} id ${box.token} (broker ${box.port})`);
  lib.saveJson(`${lib.OUT}/delivery-test-box.json`, { ...box, password, at: lib.stamp() });

  const r = await rpc.call(
    'RegisterWithEmail',
    { email: box.address, password, inviteHash: '', freeCreditCode: '', analyticsData: {} },
    { headers: { 'X-Recaptcha-Token': '', 'X-Email-Domain': 'example.com' }, tries: 8 }
  );
  lib.log(
    'delivery-test',
    `RegisterWithEmail (EMPTY token) -> ${r.status} ${String(JSON.stringify(r.json || r.text || r.error || '')).slice(0, 200)} via ${r.proxy || '-'}`
  );

  const deadline = Date.now() + MINUTES * 60000;
  let checks = 0;
  while (Date.now() < deadline) {
    checks++;
    const mail = await lib.brokerList(9700, box.token).catch(() => null);
    const msgs = Array.isArray(mail) ? mail : (mail && mail.messages) || [];
    if (msgs.length) {
      lib.log('delivery-test', `MAIL ARRIVED after ${Math.round((Date.now() - (deadline - MINUTES * 60000)) / 1000)}s: ${JSON.stringify(msgs.slice(0, 2)).slice(0, 400)}`);
      lib.saveJson(`${lib.OUT}/delivery-test-mail.json`, msgs.slice(0, 3));
      return;
    }
    if (checks === 1 || checks % 5 === 0) {
      lib.log('delivery-test', `check ${checks}: inbox has ${msgs.length} messages (${Math.round((deadline - Date.now()) / 1000)}s left)`);
    }
    await lib.sleep(20000);
  }
  lib.log('delivery-test', `NO MAIL within ${MINUTES} minutes (${checks} checks) — delivery gate confirmed`);
})().catch((e) => {
  lib.log('delivery-test', `FAIL ${e.stack}`);
  process.exit(1);
});
