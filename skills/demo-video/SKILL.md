---
name: demo-video
description: Produce a product demo / walkthrough video (1080p MP4) from a script — branded title, section and bullet slides, real website pages recorded in headless Chrome with captions, highlights and a visible cursor, JSON/API and terminal screens — optionally narrated with a local neural voice. Files every render in ~/Documents/claude-videos/<path>/<video_name>-<timestamp>.mp4 with a -latest link, per-scene clips, archived scenes source and a preview contact sheet. Use whenever the user says "make/prepare/generate a demo video", "record a walkthrough", "turn this script into a video", "video with voiceover/audio/narration", or asks to re-render or update an existing demo video.
---

# Demo video

Turn a demo script into a finished MP4 the same way every time: write a **scenes file** (one entry per scene: what's on screen + what the narrator says), run the renderer, check the contact sheet, report the path.

## Where videos go
**Don't pass an output path.** Every render is filed in one library, mirroring `~/Documents/claude-artifacts`:

```
~/Documents/claude-videos/                 ← $CLAUDE_VIDEO_DIR overrides
└── <path>/                                ← --path, else the scenes file's `slug`
    ├── <video_name>-2026-09-29-1015.mp4   one file per render, never overwritten (-2, -3 in the same minute)
    ├── <video_name>-latest.mp4            symlink → newest render
    ├── source/                            everything needed to reproduce a render (the scratchpad copy gets wiped)
    │   ├── <video_name>-2026-09-29-1015/
    │   │   ├── <video_name>.scenes.js     the scenes — edit this and re-render
    │   │   ├── narration.json             narration text per scene
    │   │   ├── engine/                    snapshot of render.js, kit.js, setup.sh used for this render
    │   │   └── README.md                  exact re-render command
    │   └── latest → <video_name>-2026-09-29-1015
    ├── clips/<render>/NN_<scene>.mp4      each finished scene (with its audio) — hand these to an editor
    ├── clips/latest → <render>
    ├── preview/<render>/{montage.png, TIMELINE.txt, NN_<scene>.jpg}
    ├── preview/latest → <render>
    └── .work/<video_name>/                raw recording cache (lets --only re-record one scene)
```

`<video_name>` = `--name`, else the scenes file's `name`, else the slug. Pass `--out <dir>` or `--out <file.mp4>` only when the user names a destination.

## Audio
**Silent by default** (a silent AAC track is still included so editors import cleanly). Add `--audio` **only when the user asks for audio / voiceover / narration**. Narration is Piper, a free neural TTS that runs locally (nothing is sent to any service). Voices: `ryan` (default, US male), `amy`, `lessac`, `libritts`, `alan` (UK male), `jenny` (UK female) — `--voice amy`. Fetch extra voices with `bash ~/.claude/skills/demo-video/setup.sh amy`.

When narration outlasts a scene's picture, the last frame is held — so on recorded pages, make `run` roughly as long as the narration to avoid long freezes (slides holding is fine).

Never switch to a paid TTS (e.g. ElevenLabs) without the user explicitly approving the cost.

## Steps
1. **Setup (first use on a machine):** `bash ~/.claude/skills/demo-video/setup.sh` — idempotent; installs playwright-core + Piper + the ryan voice into `~/.local/share/claude-demo-video`. Needs `ffmpeg` and Google Chrome/Chromium.
2. **Research what to show.** Probe every URL you'll record (status + that the content is what the script claims). Only show public pages or ones you have been given access to. Pick concrete, real examples (a real product, a real API call) — never invent data shown on screen.
3. **Write the scenes file** in the scratchpad (`<scratchpad>/<slug>.scenes.js`). Start from `~/.claude/skills/demo-video/example.scenes.js`. Keep `narration` and on-screen captions saying the same thing.
4. **Render:**
   ```bash
   node ~/.claude/skills/demo-video/render.js <scratchpad>/<slug>.scenes.js [--audio] [--voice ryan] [--path <dir>] [--name <video_name>]
   ```
   Long videos take several minutes — run it in the background (`run_in_background`) rather than blocking on a timeout.
5. **Verify visually** — Read `preview/<render>/montage.png` (one frame per scene). Look for: popups/cookie banners covering content, blank or error pages, captions overlapping important content, light text on light backgrounds (host page CSS can override panels), overlapping text in custom slides. Fix and re-render just the broken scenes with `--only name1,name2` (other scenes reuse the cached recording; narration and stitching are redone).
6. **Report** the video path, duration, scene count, narrated or silent, and the preview/timeline paths — plus anything the user must record themselves (logged-in apps, desktop apps).

## Scenes file
```js
module.exports = {
  slug: 'acme-demo',            // library folder (overridable with --path)
  name: 'acme-demo',            // video file name (overridable with --name)
  brand: { primary: '#047857', logo: 'Acme™' },   // optional; the rest of the palette is derived from primary (override: accent, light, bg, bgDeep, bgGlow, text, muted, font)
  voiceSpeed: 1.05,             // optional Piper length scale (>1 = slower)
  context: {},                  // optional extra Playwright context options (e.g. storageState for a logged-in session)
  maxSceneSeconds: 300,         // optional safety limit per scene (default 300)
  scenes: [
    { name: 'title', narration: 'Spoken text…', run: (k) => k.slide(k.titleSlide({ title: '…', subtitle: '…' }), 7) },
    { name: 'site', narration: '…', run: async (k) => { await k.open(url); await k.start(); await k.caption('Kicker', 'Title', 'Body'); await k.scroll(1200, 5000); } },
  ],
};
```

Every `run(k)` must start the recording exactly once: `k.slide(...)` does it itself; for pages, set the page up first and then `await k.start()` so loading isn't filmed.

### Kit reference (`k`)
| Helper | Does |
| --- | --- |
| `k.slide(html, seconds)` | Full-screen generated slide; starts recording and captures entrance animations |
| `k.titleSlide({title, subtitle, footer})` · `k.sectionSlide({kicker, title, body})` · `k.bulletSlide({kicker, title, bullets[], footer})` · `k.columnsSlide({kicker, columns:[{title, bullets[]}]})` · `k.endSlide({line})` | Branded slide HTML (bullets accept inline HTML, `<b>` for emphasis) |
| `k.doc(bodyHtml, css)` | Branded blank document for custom slides/diagrams (classes: `.wrap .k h1 h2 p .bar .in .d1…d8 .flow`) |
| `k.open(url, {urlBar, removeSelectors})` | Navigate a real page, strip common popups, show a URL bar |
| `k.start()` | Begin capturing frames |
| `k.caption(kicker, title, body)` / `k.hideCaption()` | Animated lower-third |
| `k.highlight(selector, on)` | Outline + scroll into view |
| `k.click(selector, {click})` / `k.type(selector, text)` | Visible cursor glides and clicks / types at human speed |
| `k.scroll(px, ms)` / `k.scrollEl(selector, px, ms)` | Smooth scroll page / an element (`'#code'`, `'#dv-drawer pre'`) |
| `k.drawer(title, objOrText)` / `k.closeDrawer()` | Slide-in right panel with highlighted JSON — great for "what the machine sees" next to the real page |
| `k.jsonView(method, url, objOrText)` | Full-screen HTTP response viewer (scroll `#code`) |
| `k.terminal(cmd, output, title)` + `k.typeAndRun()` | Terminal that types the command, then reveals the output |
| `k.show(html)` | Swap to another generated screen mid-scene without restarting the recording |
| `k.page`, `k.sleep(ms)`, `k.esc`, `k.palette` | Raw Playwright page and utilities |

Fetch live data inside `run` (Node 20+ `fetch`) so what's on screen is real.

## Narration tips
- Spell out acronyms the way they should be spoken: `U C P`, `M C P`, `J SON L D`, `L L M's dot text`, `O Auth`, `P K C E`, `E S 256`.
- If a brand name is mispronounced, respell it phonetically in `narration` only (captions keep the real spelling).
- Roughly 2.5 words per second — size scene timings from that.

## Guardrails
- Record only public pages, or logged-in pages the user explicitly provided access for. Never film secrets: `.env` files, API keys, webhook secrets, tokens in URLs. Blur or skip pages that show them.
- Don't perform state-changing actions on live/production systems (saving products, placing orders, rotating secrets) unless the user explicitly approved that specific action.
- No claims on screen or in narration that the product doesn't actually do; label simulations as simulations.
- Don't commit rendered videos into code repositories.
