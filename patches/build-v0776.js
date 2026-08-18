// build-v0776.js — Add v0.7.7.5 + v0.7.7.6 to thinkfox_1-v0774.html
const fs = require('fs');
const path = require('path');

const SRC = 'thinkfox_1-v0774.html';
const OUT = 'thinkfox_1-v0776.html';

const PATCHES = [
    'patch-v0775.js',
'patch-v0776.js'
];

// ── Pre-flight checks ──────────────────────────────────────────

if (!fs.existsSync(SRC)) {
    console.error(`✘ Source file not found: ${SRC}`);
    process.exit(1);
}

for (const file of PATCHES) {
    if (!fs.existsSync(file)) {
        console.error(`✘ Missing patch file: ${file}`);
        process.exit(1);
    }
}

// ── Helpers ────────────────────────────────────────────────────

function stripScriptTags(code) {
    return code
    .replace(/^\s*<script[^>]*>/i, '')
    .replace(/<\/script>\s*$/i, '')
    .trim();
}

// ── Read source ────────────────────────────────────────────────

let html = fs.readFileSync(SRC, 'utf8');

// ── 1. Version update: 1-v0.7.7.4 → 1-v0.7.7.6 ───────────────

const versionRe = /1-v0\.7\.7\.4/g;
const hits = (html.match(versionRe) || []).length;
html = html.replace(versionRe, '1-v0.7.7.6');

// Affected locations in the v0.7.7.4 build:
//   <title>Think Fox 1-v0.7.7.4 by Monty Kubasek</title>
//   .topbar-brand-line
//   .welcome-title
//   exportWorkplace() appVersion

// ── 2. Inject patches before </body> ──────────────────────────

const blocks = PATCHES.map(file => {
    const code = stripScriptTags(fs.readFileSync(file, 'utf8'));
    return `\n<script>\n${code}\n</script>\n`;
}).join('');

if (!html.includes('</body>')) {
    console.error('✘ Source file has no </body> tag.');
    process.exit(1);
}

html = html.replace('</body>', `${blocks}</body>`);

// ── 3. Verify expected guards are present ─────────────────────

const guards = [
    ['__thinkfoxProjectsV0771',        'v0.7.7.1 Projects Foundation'],
['__thinkfoxProjectMemoriesV0772', 'v0.7.7.2 Project Memories'],
['__thinkfoxProjectContextV0773',  'v0.7.7.3 Project Context Index'],
['__thinkfoxProjectRetrievalV0774','v0.7.7.4 Project Retrieval'],
['__thinkfoxGitHubV0775',          'v0.7.7.5 GitHub Repo Access'],
['__thinkfoxV0776',                'v0.7.7.6 Polish/Hardening/RC']
];

let allGuards = true;
for (const [guard, label] of guards) {
    if (!html.includes(guard)) {
        console.error(`✘ Missing guard: ${guard} (${label})`);
        allGuards = false;
    }
}

if (!allGuards) {
    console.error('✘ Build aborted — not all patches are present in the source or patch files.');
    process.exit(1);
}

// ── 4. Verify no stale version strings remain ─────────────────

const staleCheck = html.match(/1-v0\.7\.7\.[0-4](?!\d)/g);
if (staleCheck) {
    console.warn(`⚠ ${staleCheck.length} stale version string(s) found (v0.7.7.0–4). The v0.7.7.6 runtime bump will fix these in the DOM, but check the source.`);
}

// ── 5. Write output ───────────────────────────────────────────

fs.writeFileSync(OUT, html, 'utf8');

console.log(`✔ Version strings updated: ${hits} (1-v0.7.7.4 → 1-v0.7.7.6)`);
console.log(`✔ Patches injected: ${PATCHES.length}`);
console.log(`✔ All 6 module guards verified`);
console.log(`✔ Output: ${path.resolve(OUT)}`);
console.log(`✔ Size: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
