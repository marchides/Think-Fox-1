// build-v0774.js — Think Fox v0.7.7.1 → v0.7.7.4 assembly
const fs = require('fs');
const path = require('path');

const SRC = 'thinkfox_1-v077-fixed.html';
const OUT = 'thinkfox_1-v0774.html';

const PATCHES = [
  'patch-v0771-projects.js',
'patch-v0772-project-memories.js',
'patch-v0773-project-context.js',
'patch-v0774-project-retrieval.js'
];

function stripScriptTags(code) {
  return code
  .replace(/^\s*<script[^>]*>/i, '')
  .replace(/<\/script>\s*$/i, '')
  .trim();
}

let html = fs.readFileSync(SRC, 'utf8');

// ── 1. Version update: every app-level "1-v0.7.7" → "1-v0.7.7.4" ──
// Negative lookahead avoids double-bumping anything already at 0.7.7.x
const versionRe = /1-v0\.7\.7(?!\.)/g;
const hits = (html.match(versionRe) || []).length;
html = html.replace(versionRe, '1-v0.7.7.4');

// Affected locations (verified against base):
//   <title>Think Fox 1-v0.7.7 by Monty Kubasek</title>
//   .topbar-brand-line  → Think Fox 1-v0.7.7
//   .welcome-title      → Think Fox&nbsp;1-v0.7.7
//   exportWorkplace()   → appVersion: '1-v0.7.7'
//   final build comment → // Think Fox 1-v0.7.7 verified build...

// ── 2. Inject patches in strict dependency order before </body> ──
const blocks = PATCHES.map(file => {
  if (!fs.existsSync(file)) {
    console.error(`MISSING: ${file}`);
    process.exit(1);
  }
  const code = stripScriptTags(fs.readFileSync(file, 'utf8'));
  return `\n<script>\n${code}\n</script>\n`;
}).join('');

if (!html.includes('</body>')) {
  console.error('Base file has no </body> tag.');
  process.exit(1);
}

html = html.replace('</body>', `${blocks}</body>`);

// ── 3. Write output ──
fs.writeFileSync(OUT, html, 'utf8');

console.log(`✔ Version strings updated: ${hits}`);
console.log(`✔ Patches injected: ${PATCHES.length}`);
console.log(`✔ Output: ${path.resolve(OUT)}`);
console.log(`✔ Size: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
