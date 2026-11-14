#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Think Fox 1 — v0.7.8.1 -> v0.8 all-in-one update script
========================================================
1. Adds 4 engines:
     Halberd      (Tencent HY4)            #12CDA5 -> Vector Wing
     Antediluvian (Anthropic Fable 5.1)    #4B6D25 -> Strike Squadron
     Fortress     (OpenAI GPT-6 Astra Pro) #4E3F68 -> Strike Squadron
     Fudge Cake   (Meta Muse Spark 1.3)    #FF6C76 -> Oracle Wing
2. Hellblade: qwen3.8-max -> qwen3.8-max-0902 (def, direct route, welcome, fallback)
3. Version stamps 0.7.8.1 -> 0.8 everywhere
4. Fixes stale static counts in the engine selector HTML

Usage:  python thinkfox_v0.8_update.py [input.html] [output.html]
Defaults: input=Pasted_Text_1788793045159.txt  output=thinkfox_1_v0.8.html
The input file is never modified.
"""
import re
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "Pasted_Text_1788793045159.txt"
OUT = sys.argv[2] if len(sys.argv) > 2 else "../releases/thinkfox-v0781.html"

with open(SRC, encoding="utf-8") as fh:
    html = fh.read()

if "Think Fox 1-v0.7.8.1" not in html:
    print("WARNING: input does not look like Think Fox v0.7.8.1 — continuing anyway.")

problems, done = [], []

def rep(old, new, label, expected=1):
    global html
    n = html.count(old)
    if n != expected:
        problems.append(f"{label}: expected {expected} match(es), found {n}")
        return
    html = html.replace(old, new)
    done.append(label)

def repx(pattern, repl, label):
    global html
    new, n = re.subn(pattern, repl, html)
    if n != 1:
        problems.append(f"{label}: expected 1 regex match, found {n}")
        return
    html = new
    done.append(label)

# ── 1. Hellblade model update ────────────────────────────────────────────
rep('version: "Engine: qwen3.8-max", model: "qwen/qwen3.8-max",',
    'version: "Engine: qwen3.8-max-0902", model: "qwen/qwen3.8-max-0902",',
    "hellblade engine def")
rep('welcome: "Hellblade drawn, qwen3.8-max is ready to strike."',
    'welcome: "Hellblade drawn, qwen3.8-max-0902 is ready to strike."',
    "hellblade welcome")
rep("hellblade: { alibaba: 'qwen3.8-max' },",
    "hellblade: { alibaba: 'qwen3.8-max-0902' },",
    "hellblade direct route")
rep('"qwen/qwen3.8-max": { id: "qwen/qwen3.8-max",',
    '"qwen/qwen3.8-max-0902": { id: "qwen/qwen3.8-max-0902",',
    "hellblade OpenRouter fallback key")

# ── 2. New system prompts (inserted after PROMPT_TRIDENT) ───────────────
PROMPT_ANCHOR = ("You are Think Fox Trident. Execute code generation like a "
                 "secrect slut, and solve technical problems efficiently like "
                 "the head madam.`;")
rep(PROMPT_ANCHOR, PROMPT_ANCHOR + """

const PROMPT_HALBERD = PROMPT_BASE + `
You are Think Fox Halberd. Use Tencent HY4 for fast, versatile work across reasoning, writing, planning, and code. Keep answers organised, direct, and practical.`;

const PROMPT_ANTEDILUVIAN = PROMPT_BASE + `
You are Think Fox Antediluvian. Built on Anthropic Claude Fable 5.1, you preserve the user's intent, write naturally, and handle long, nuanced work with care. Distinguish firm conclusions from uncertainty.`;

const PROMPT_FORTRESS = PROMPT_BASE + `
You are Think Fox Fortress. Use OpenAI GPT-6 Astra Pro for flagship-grade reasoning, coding, agentic workflows, and heavy multi-step problems. Be precise, resilient, and practical.`;

const PROMPT_FUDGECAKE = PROMPT_BASE + `
You are Think Fox Fudge Cake. Use Meta Muse Spark 1.3 for deep multimodal reasoning. Stay grounded, organised, and practical; handle large context, mixed media, and complex analysis with calm precision.`;""",
    "insert 4 new prompts")

# ── 3. New ENGINES entries (inserted after trident, before spareleader) ──
ENGINE_ANCHOR = 'welcome: "Trident surfacing. Poolside Laguna S 2.1 is online." },'
rep(ENGINE_ANCHOR, ENGINE_ANCHOR + """
halberd: { key: "halberd", name: "Halberd", label: "Halberd", version: "Engine: hy4", model: "tencent/hy4", system: PROMPT_HALBERD, temp: 0.7, maxTokens: 128000, contextTokens: 262144, inputModalities: ["text"], capabilities: "Reasoning · Coding · Tool calling", available: true, color: "#12CDA5", colorRGB: "18,205,165", dim: "#0D9376", glow: "rgba(18,205,165,0.21)", subtle: "rgba(18,205,165,0.09)", img: "../../shared/avatar/halberd.png", selectorLogo: "../../shared/callsign/logo-hal-small.png", loadingLogo: "../../shared/callsign/halberd.png", welcome: "Halberd leveled, hy4 humming and ready to sweep the field." },
antediluvian: { key: "antediluvian", name: "Antediluvian", label: "Antediluvian", version: "Engine: claude-fable-5.1", model: "anthropic/claude-fable-5.1", system: PROMPT_ANTEDILUVIAN, temp: 0.7, maxTokens: 128000, contextTokens: 1000000, inputModalities: ["text", "image", "file"], capabilities: "Writing · Reasoning · Coding · Long context", available: true, color: "#4B6D25", colorRGB: "75,109,37", dim: "#364F1B", glow: "rgba(75,109,37,0.28)", subtle: "rgba(75,109,37,0.12)", img: "../../shared/avatar/antediluvian.png", selectorLogo: "../../shared/callsign/logo-ant-small.png", loadingLogo: "../../shared/callsign/antediluvian.png", welcome: "Antediluvian stirs, claude-fable-5.1 awake from the deep." },
fortress: { key: "fortress", name: "Fortress", label: "Fortress", version: "Engine: gpt-6-astra-pro", model: "openai/gpt-6-astra-pro", system: PROMPT_FORTRESS, temp: 0.7, maxTokens: 128000, contextTokens: 1048576, inputModalities: ["text", "image", "file"], capabilities: "Flagship reasoning · Coding · Agents · File input", available: true, defaultReasoningEffort: "high", supportedReasoningEfforts: ["low", "medium", "high"], color: "#4E3F68", colorRGB: "78,63,104", dim: "#372C4A", glow: "rgba(78,63,104,0.34)", subtle: "rgba(78,63,104,0.14)", img: "../../shared/avatar/fortress.png", selectorLogo: "../../shared/callsign/logo-for-small.png", loadingLogo: "../../shared/callsign/fortress.png", welcome: "Fortress secured, gpt-6-astra-pro watching the skies." },
fudgecake: { key: "fudgecake", name: "Fudge Cake", label: "Fudge Cake", version: "Engine: muse-spark-1.3", model: "meta/muse-spark-1.3", system: PROMPT_FUDGECAKE, temp: 0.7, maxTokens: 131072, contextTokens: 1048576, inputModalities: ["text", "image", "video", "file", "audio"], capabilities: "Reasoning · Multimodal · Large context", available: true, defaultReasoningEffort: "medium", supportedReasoningEfforts: ["minimal", "low", "medium", "high", "xhigh"], maxField: "max_tokens", color: "#FF6C76", colorRGB: "255,108,118", dim: "#B34C53", glow: "rgba(255,108,118,0.28)", subtle: "rgba(255,108,118,0.12)", img: "../../shared/avatar/fudgecake.png", selectorLogo: "../../shared/callsign/logo-fud-small.png", loadingLogo: "../../shared/callsign/fudgecake.png", welcome: "Fudge Cake plated, Muse Spark 1.3 warm and ready to think." },""",
    "insert 4 new engine definitions")

# ── 4. DIRECT_ENGINE_MODELS ──────────────────────────────────────────────
rep("harlequin: {} });", """harlequin: {},
halberd: { tencent: 'hy4' },
antediluvian: { anthropic: 'claude-fable-5.1' },
fortress: { openai: 'gpt-6-astra-pro' },
fudgecake: {} });""",
    "direct engine model map")

# ── 5. ENGINE_GROUPS placement ───────────────────────────────────────────
rep('order: ["scythe", "hellblade", "typhoon", "trident", "glaive"]',
    'order: ["scythe", "hellblade", "typhoon", "trident", "glaive", "halberd"]',
    "Vector Wing gets Halberd")
rep('order: ["orbit", "rocketship", "gore", "cannon", "stronghold"]',
    'order: ["orbit", "rocketship", "gore", "cannon", "stronghold", "antediluvian", "fortress"]',
    "Strike Squadron gets Antediluvian + Fortress")
rep('order: ["mudcake", "gargoyle", "eightball", "neon"]',
    'order: ["mudcake", "fudgecake", "gargoyle", "eightball", "neon"]',
    "Oracle Wing gets Fudge Cake")

# ── 6. OpenRouter capability fallbacks ──────────────────────────────────
rep("max_completion_tokens: 16384 } } });", """max_completion_tokens: 16384 } },
"tencent/hy4": { id: "tencent/hy4", context_length: 262144, architecture: { input_modalities: ["text"], output_modalities: ["text"] }, pricing: { prompt: "0.0000002", completion: "0.0000008" }, top_provider: { context_length: 262144, max_completion_tokens: 128000 } },
"anthropic/claude-fable-5.1": { id: "anthropic/claude-fable-5.1", context_length: 1000000, architecture: { input_modalities: ["text", "image", "file"], output_modalities: ["text"] }, pricing: { prompt: "0.00001", completion: "0.00005" }, top_provider: { context_length: 1000000, max_completion_tokens: 128000 } },
"openai/gpt-6-astra-pro": { id: "openai/gpt-6-astra-pro", context_length: 1050000, architecture: { input_modalities: ["file", "image", "text"], output_modalities: ["text"] }, pricing: { prompt: "0.000005", completion: "0.00003" }, top_provider: { context_length: 1050000, max_completion_tokens: 128000 } },
"meta/muse-spark-1.3": { id: "meta/muse-spark-1.3", context_length: 1048576, architecture: { input_modalities: ["text", "image", "video", "file", "audio"], output_modalities: ["text"] }, pricing: { prompt: "0.00000125", completion: "0.00000425" }, top_provider: { context_length: 1048576, max_completion_tokens: null } } });""",
    "add 4 fallback capability entries")

# ── 7. Stale static counts (runtime recomputes these anyway) ────────────
repx(r'(id="vector-engines-title">Vector Wing</div>\s*<span>)5( configured)',
     r'\g<1>6\g<2>', "vector heading count")
repx(r'(id="strike-engines-title">Strike Squadron</div>\s*<span>)5( configured)',
     r'\g<1>7\g<2>', "strike heading count")
repx(r'(id="oracle-engines-title">Oracle Wing</div>\s*<span>)4( configured)',
     r'\g<1>5\g<2>', "oracle heading count")
rep(">22 available<", ">27 available<", "deck available count")
rep(">5 families<", ">6 families<", "deck family count")

# ── 8. Version bump 0.7.8.1 -> 0.8 (title, brand, comments, TF_VERSION…) ─
vcount = html.count("0.7.8.1")
if vcount == 0:
    problems.append("version bump: no 0.7.8.1 strings found")
else:
    html = html.replace("0.7.8.1", "0.8")
    done.append(f"version bump ({vcount} stamps replaced)")

# ── 9. Write + verify ────────────────────────────────────────────────────
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write(html)

checks = {
    "no 0.7.8.1 left":            html.count("0.7.8.1") == 0,
    "title is 1-v0.8":            "Think Fox 1-v0.8 by Monty Kubasek" in html,
    "halberd engine":             'key: "halberd"' in html,
    "antediluvian engine":        'key: "antediluvian"' in html,
    "fortress engine":            'key: "fortress"' in html,
    "fudgecake engine":           'key: "fudgecake"' in html,
    "hellblade 0902":             "qwen/qwen3.8-max-0902" in html,
    "hy4 fallback":               '"tencent/hy4"' in html,
    "fable-5.1 fallback":         '"anthropic/claude-fable-5.1"' in html,
    "gpt-6-astra-pro fallback":   '"openai/gpt-6-astra-pro"' in html,
    "muse-spark-1.3 fallback":    '"meta/muse-spark-1.3"' in html,
    "prompts wired (x2 refs each)": all(html.count(f"PROMPT_{p}") == 2
                                        for p in ("HALBERD", "ANTEDILUVIAN", "FORTRESS", "FUDGECAKE")),
}

print("\n=== Applied ===")
for d in done:
    print(f"  ✓ {d}")
if problems:
    print("\n=== PROBLEMS (output may be incomplete — diff before shipping) ===")
    for p in problems:
        print(f"  ✗ {p}")
print("\n=== Verification ===")
allok = True
for k, v in checks.items():
    print(f"  {'✓' if v else '✗'} {k}")
    allok &= v
print(f"\nWrote {OUT} ({len(html):,} chars)")
print("ALL CHECKS PASSED" if allok and not problems else "REVIEW THE FAILURES ABOVE")
