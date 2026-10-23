#!/usr/bin/env node
'use strict';

/**
 * Command dispatcher for cohere-bulk-apikey.
 *
 *   node src/cli.js mint     create fresh accounts and mint one key each
 *   node src/cli.js finish   log in to accounts already created and finish their key
 *   node src/cli.js verify   re-check keys that are already on disk
 *   node src/cli.js 9router  register the keys in keys.txt with a 9Router instance
 *   node src/cli.js help
 *
 * Every task spawns the matching module in this folder, so a crash in one run
 * never leaves state behind in this process.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const TASKS = {
  mint: { file: 'mint.js', note: 'create fresh accounts and mint one key each' },
  finish: { file: 'finish.js', note: 'log in to accounts already created and finish their key' },
  verify: { file: 'verify.js', note: 're-check keys that are already on disk' },
  '9router': { file: 'connect-9router.js', note: 'register the keys in keys.txt with a 9Router instance' },
};

function help() {
  console.log('cohere-bulk-apikey — one account per key\n');
  console.log('usage: node src/cli.js <task> [options]\n');
  console.log('tasks:');
  for (const [name, t] of Object.entries(TASKS)) console.log('  ' + name.padEnd(9) + ' ' + t.note);
  console.log('  --count N     keys to mint (the one-command path: node src/cli.js --count N)');
  console.log('\noptions: every task takes its own flags — ask it directly:');
  console.log('  node src/<task-file> --help');
  console.log('\nproxy pool:');
  console.log('  one exit per line in proxies.txt — scheme://host:port[#comment], user:pass@ supported');
  console.log('\nno options? run the interactive launcher:  node src/launcher.js');
  console.log('  --auto        solve the register reCAPTCHA with src/solver.js (default, headful Chrome)');
  console.log('  --dry         print the resolved plan, write nothing, send nothing');
  console.log('  keys-dead.txt keys verify called dead (401) are written next to the repo root');
}


/**
 * `--dry`: the resolved plan, then exit 0. The dispatcher never spawns a task
 * module, so nothing is written and no request is sent.
 */
if (process.argv.includes('--dry')) {
  const dryArgv = process.argv.slice(2);
  const val = (name, dflt) => {
    const i = dryArgv.indexOf(name);
    return i >= 0 && dryArgv[i + 1] && !dryArgv[i + 1].startsWith('--') ? dryArgv[i + 1] : dflt;
  };
  const poolFile = process.env.COHERE_PROXIES || 'proxies.txt';
  const exits = (() => {
    try {
      return require('fs').readFileSync(path.resolve(__dirname, '..', poolFile), 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).length;
    } catch (e) {
      return 0;
    }
  })();
  const solverOk = (() => {
    try {
      return typeof require('./solver.js').solveCaptcha === 'function';
    } catch (e) {
      return false;
    }
  })();
  console.log('cohere dry run — nothing is written and no request is sent.');
  console.log(`  task     ${dryArgv[0] && !dryArgv[0].startsWith('--') ? dryArgv[0] : 'mint'}`);
  console.log(`  count    ${val('--count', '20')} key(s), model ${val('--model', 'command-a-03-2025')}`);
  console.log(`  pool     ${exits ? `${exits} exit(s) from ${poolFile}` : `direct (no usable exit in ${poolFile})`}`);
  console.log(`  solver   ${solverOk ? 'src/solver.js present (--auto, default) — reCAPTCHA Enterprise via headful Chrome' : 'src/solver.js MISSING'}`);
  console.log('  keys     keys.txt · verify writes dead keys to keys-dead.txt');
  process.exit(0);
}
const argv = process.argv.slice(2);
// A leading flag (not help/dry) means the one-command path: mint.
const task = argv[0] === '--connect-9router' ? '9router' : (argv[0] && argv[0].startsWith('--') && !['--help', '-h'].includes(argv[0]) ? 'mint' : argv[0]);
if (!task || task === 'help' || task === '--help' || task === '-h') {
  help();
  process.exit(0);
}
const entry = TASKS[task];
if (!entry) {
  console.error('unknown task: ' + task + '\n');
  help();
  process.exit(1);
}
const child = spawnSync(process.execPath, [path.join(__dirname, entry.file), ...argv.slice(1)], {
  windowsHide: true,
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
});
process.exit(child.status === null ? 1 : child.status);
