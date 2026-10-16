'use strict';
// Chrome + CDP plumbing for the Cohere browser flow.
// One Chrome per run; one context per account, each pinned to one pool exit.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { CDP } = require('./cdp.js');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
// No UA override anywhere: Chrome must advertise its real engine version. Forcing a
// stale UA while sec-ch-ua reports the true one is a first-class bot signal
// (measured across runs on Turnstile; same class of signal in reCAPTCHA Enterprise).
const UA = null;
const UA_NOTE = 'chrome-native';

function httpJson(port, p) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: p, timeout: 5000 }, (res) => {
        let b = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (b += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(b));
          } catch (e) {
            reject(new Error(`bad json from chrome: ${b.slice(0, 100)}`));
          }
        });
      })
      .on('error', reject);
  });
}

async function waitPort(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await httpJson(port, '/json/version');
    } catch (e) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`chrome debug port ${port} not up`);
}

function launchChrome(port, tag = 'cohere', { headless = false } = {}) {
  const profileDir = path.join(os.homedir(), `.ch-chrome-${tag}-${Date.now().toString(36)}`);
  const args = [
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profileDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--disable-domain-reliability',
    '--disable-client-side-phishing-detection',
    '--disable-breakpad',
    '--disable-default-apps',
    '--no-service-autorun',
    '--metrics-recording-only',
    '--password-store=basic',
    '--disable-features=Translate,MediaRouter,OptimizationHints',
    '--lang=en-US',
    '--window-size=1280,900',
    '--window-position=40,40',
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new', '--hide-scrollbars', '--mute-audio');
  const child = spawn(CHROME, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, 'logs', `chrome-${port}.json`),
    JSON.stringify({ pid: child.pid, port, profileDir, at: new Date().toISOString() }, null, 2)
  );
  return { pid: child.pid, profileDir, port };
}

async function connect(port) {
  const v = await waitPort(port);
  const cdp = new CDP(v.webSocketDebuggerUrl, { commandTimeoutMs: 60000 });
  await cdp.connect();
  return cdp;
}

/** Opens a page in a fresh context (optionally proxied) and wires Page/Runtime/Network. */
async function openContext(cdp, { proxyServer, url = 'about:blank', proxyBypassList } = {}) {
  const opts = {};
  if (proxyServer) opts.proxyServer = proxyServer;
  if (proxyBypassList) opts.proxyBypassList = proxyBypassList;
  const browserContextId = await cdp.createBrowserContext(opts);
  const { targetId, sessionId } = await cdp.newPage({ browserContextId, url: 'about:blank' });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  return { browserContextId, targetId, sessionId };
}

function evalJs(cdp, sessionId, expression, { awaitPromise = false } = {}) {
  return cdp
    .send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise, userGesture: true }, sessionId)
    .then((r) => {
      if (r.exceptionDetails)
        throw new Error(
          `eval: ${r.exceptionDetails.text} ${JSON.stringify((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || '').slice(0, 300)}`
        );
      return r.result.value;
    });
}

function waitLoad(cdp, sessionId, timeoutMs = 90000) {
  return cdp.waitFor('Page.loadEventFired', { timeoutMs, sessionId }).catch(() => null);
}

async function navigate(cdp, sessionId, url, timeoutMs = 90000) {
  const done = waitLoad(cdp, sessionId, timeoutMs);
  await cdp.send('Page.navigate', { url }, sessionId).catch(() => {});
  await done;
  await new Promise((r) => setTimeout(r, 800));
}

async function screenshot(cdp, sessionId, file) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  return file;
}

module.exports = { UA, CHROME, launchChrome, connect, openContext, evalJs, waitLoad, navigate, screenshot, waitPort, httpJson };
