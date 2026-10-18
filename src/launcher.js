#!/usr/bin/env node
'use strict';

/**
 * Interactive launcher for cohere-bulk-apikey — a menu over the task modules.
 * Settings persist in launcher.config.json next to this file.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

// Keep the menu alive when a task's socket dies mid-run.
process.on('uncaughtException', (e) => console.log(`WARN uncaught: ${String(e && e.message).slice(0, 180)}`));

// Leftovers from crashed runs are 40-90 MB each: sweep the profile dirs the
// mint creates. Only dirs older than 12 h go (a live Chrome keeps its own).
require('./chrome-flags.js').sweepProfiles('.ch-chrome-');

const ROOT = path.resolve(__dirname, '..'); // data root (the repo root)
const CONFIG = path.join(ROOT, 'launcher.config.json');
const POOL = path.join(ROOT, 'proxies.txt');
const KEYS = path.join(ROOT, 'keys.txt');

const defaults = { count: 30, conc: 2, preset: '' };
let cfg = { ...defaults };
try { Object.assign(cfg, JSON.parse(fs.readFileSync(CONFIG, 'utf8'))); } catch (e) {}
const save = () => fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n');
const ARGS = {"mint":["--count","count"],"finish":[],"verify":["--keys","keys.txt"]};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, fb) => new Promise((r) => rl.question(q + (fb !== undefined ? ' [' + fb + ']' : '') + ': ', (a) => r(String(a).trim() || fb)));

const LOGO = String.raw`
   ██████╗   ██████╗  ██╗  ██╗ ███████╗ ██████╗  ███████╗
  ██╔════╝  ██╔═══██╗ ██║  ██║ ██╔════╝ ██╔══██╗ ██╔════╝
  ██║       ██║   ██║ ███████║ █████╗   ██████╔╝ █████╗
  ██║       ██║   ██║ ██╔══██║ ██╔══╝   ██╔══██╗ ██╔══╝
  ╚██████╗  ╚██████╔╝ ██║  ██║ ███████╗ ██║  ██║ ███████╗
   ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚══════╝ ╚═╝  ╚═╝ ╚══════╝
`;

function banner() {
  const w = 78;
  const box = (s) => '  │ ' + s.padEnd(w) + ' │';
  console.log(LOGO);
  console.log('  ┌' + '─'.repeat(w + 2) + '┐');
  console.log(box('cohere-bulk-apikey  ·  one account per key'));
  console.log(box('cohere-bulk-apikey contributors · MIT'));
  console.log('  └' + '─'.repeat(w + 2) + '┘\n');
}

const count = (f) => { try { return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).length; } catch (e) { return 0; } };

function run(args) {
  const [file, ...rest] = args;
  console.log('\n▶ node src/' + args.join(' ') + '\n');
  const r = spawnSync(process.execPath, [path.join(__dirname, file), ...rest], { windowsHide: true, cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) console.log('\n⚠ exited with code ' + r.status);
}

function argsFor(task) {
  const spec = ARGS[task] || [];
  const a = spec.map((v) => (v === 'count' ? String(cfg.count) : v === 'conc' ? String(cfg.conc) : v));
  // Run-shape presets (operator standard v3): turbo = 5 workers, balanced = 4,
  // safe = 2. Left empty the task keeps its own historical default.
  if (cfg.preset) a.push('--preset=' + cfg.preset);
  return a;
}

async function settings() {
  console.log('\nSettings');
  console.log('  1) count      ' + cfg.count);
  console.log('  2) conc       ' + cfg.conc);
  console.log('  3) preset     ' + (cfg.preset || '(none — the task default)'));
  console.log('  0) back');
  const p = await ask('choose', '0');
  if (p === '1') cfg.count = parseInt(await ask('count', cfg.count), 10) || cfg.count;
  if (p === '2') cfg.conc = parseInt(await ask('concurrency', cfg.conc), 10) || cfg.conc;
  if (p === '3') cfg.preset = String(await ask('preset (turbo/balanced/safe, blank = none)', cfg.preset)).trim().toLowerCase();
  save();
}

async function nineRouter() {
  console.log('\n9Router — register the keys in keys.txt as one connection each');
  const base = await ask('9Router base URL', 'http://localhost:20128');
  const password = await ask('9Router password', '123456');
  const file = await ask('Key file to register (one key per line)', 'keys.txt');
  const model = await ask('Default model for the connection', 'command-a-03-2025');
  console.log('\n▶ node src/connect-9router.js --base ' + base + ' --keys-file ' + file + ' --model ' + model + '\n');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'connect-9router.js'), '--base', base, '--password', password, '--keys-file', file, '--model', model], { windowsHide: true, cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) console.log('\n⚠ exited with code ' + r.status);
}

async function main() {
  if (process.argv.includes('--connect-9router')) {
    await nineRouter();
    rl.close();
    return;
  }
  process.stdout.write('\x1b[2J\x1b[H');
  banner();
  console.log('  proxy exits: ' + (count(POOL) || 'none — put exits in proxies.txt') + '     keys on disk: ' + count(KEYS) + '\n');
  console.log('  1) mint      create fresh accounts and mint one key each');
  console.log('  2) finish    log in to accounts already created and finish their key');
  console.log('  3) verify    re-check keys that are already on disk');
  console.log('  4) Settings');
  console.log('  5) 9Router   register the keys in keys.txt with a 9Router instance');
  console.log('  0) Exit\n');
  const choice = await ask('choose', '1');
  if (choice === '1') {
    run(['mint.js', ...argsFor('mint')]);
  }
  else if (choice === '2') {
    run(['finish.js', ...argsFor('finish')]);
  }
  else if (choice === '3') {
    run(['verify.js', ...argsFor('verify')]);
  }
  else if (choice === '4') {
    await settings();
  }
  else if (choice === '5') {
    await nineRouter();
  } else {
    rl.close();
    return;
  }
  await ask('\npress enter for the menu', '');
  return main();
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Interactive launcher: run `node src/launcher.js` and pick a menu item.');
  process.exit(0);
}

main().catch((e) => { console.error('launcher failed:', e.stack || e.message); process.exit(1); });
