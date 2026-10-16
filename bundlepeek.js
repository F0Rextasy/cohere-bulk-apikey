'use strict';
// Local static analysis of the dashboard bundle: pulls the auth/client class
// members and any path/URL map out of the minified _app chunk.
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, 'out', 'recon', '_app-8f3d75f0cc65c950.js');
const t = fs.readFileSync(file, 'utf8');
const start = parseInt(process.argv[3] || '1075863', 10);
const end = parseInt(process.argv[4] || '1120000', 10);
const region = t.slice(start, Math.min(end, t.length));

const members = new Set();
for (const m of region.matchAll(/\(this,"([A-Za-z_][A-Za-z0-9_\-]{1,40})",function/g)) members.add(m[1]);
console.log('methods:', [...members].join(', '));
console.log();

const props = new Set();
for (const m of region.matchAll(/\(this,"([a-z][A-Za-z0-9_]{1,30})","([^"]{0,80})"/g)) props.add(`${m[1]} = ${m[2]}`);
console.log('props:', [...props].join('\n  '));
console.log();

const urls = new Set();
for (const m of region.matchAll(/["'`](https?:\/\/[A-Za-z0-9_\-.\/:%?&=]{4,120})["'`]/g)) urls.add(m[1]);
console.log('urls:', [...urls].join('\n  '));
console.log();

const rel = new Set();
for (const m of region.matchAll(/["'`](\/[A-Za-z0-9_\-.\/{}:]{2,80})["'`]/g)) rel.add(m[1]);
console.log('paths:', [...rel].join('\n  '));
