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

Write scenes as **beats** (below): each beat's speech is synthesized first and measured, and the recording waits for it, so picture and voice cannot drift apart. Default pace is ~130 words/minute (`voiceSpeed: 1.22`) with a 0.8 s pause after each sentence (`beatGap`).

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

## Writing for viewers (what makes a demo understandable)
Learned from client feedback on a first cut that was "too fast, audio and video don't match, too technical":
- **One idea per beat, and the screen shows only that idea.** Never put a whole diagram or list on screen and then talk over it — reveal each box/bullet/card *as it is spoken* (`steps: true` / `.step` + `k.next()` / `k.reveal()`), and spotlight it with `k.focus()`.
- **Plain language for a non-technical viewer.** Say what it *does for them* ("the translator", "a hidden label for computers", "a welcome note for AI"), not the mechanism ("normalize", "JSON-LD", "PKCE", "JWKS"). Technical names can appear small on screen; the narration explains them simply.
- **Don't show walls of code.** Show a plain-language card or product cards, and if raw data matters, show it small at the side with only the lines being discussed lit up (`k.mark()`).
- **Slow down.** Keep the default pace; for dense scenes split long sentences into more beats rather than speeding up.
- **Pronunciation** belongs in `pronounce` (e.g. `{ Goofre: 'go free', 'llms.txt': 'L-L-M-s dot text', UCP: 'U C P' }`), so narration stays readable and captions keep real spelling.

## Scenes file
```js
module.exports = {
  slug: 'acme-demo',            // library folder (overridable with --path)
  name: 'acme-demo',            // video file name (overridable with --name)
  brand: { primary: '#047857', logo: 'Acme™' },   // optional; the rest of the palette is derived from primary (override: accent, light, bg, bgDeep, bgGlow, text, muted, font)
  voiceSpeed: 1.22,             // Piper length scale (>1 = slower); 1.22 ≈ 130 wpm
  beatGap: 0.8,                 // seconds of silence after each beat
  sentencePause: 0.5,           // pause between sentences inside one beat
  pronounce: { Acme: 'Ack me', UCP: 'U C P' },     // spoken form of words (whole-word, case-insensitive)
  context: {},                  // optional extra Playwright context options (e.g. storageState for a logged-in session)
  maxSceneSeconds: 300,         // optional safety limit per scene (default 300)
  scenes: [
    {
      name: 'why',
      setup: (k) => k.present(k.bulletSlide({ title: 'Why it matters', steps: true, bullets: ['Fast', 'Simple'] })),
      beats: [
        { say: 'Here is why it matters.' },                               // nothing new on screen
        { say: 'First, it is fast.', do: (k) => k.next() },               // bullet 1 appears as it is said
        { say: 'And second, it is simple.', do: (k) => k.next() },
      ],
    },
    {
      name: 'site',
      setup: (k) => k.open('https://example.com'),                       // recording starts after setup
      beats: [
        { say: 'This is the home page.', do: (k) => k.caption('Home', 'The home page') },
        { say: 'Here is the price.', do: (k) => k.highlight('.price') },
        { say: 'A list read out in one sentence.', do: (k, b) => k.revealAcross(3, b.duration) },   // b.duration = this beat's speech length
      ],
    },
  ],
};
```

- A **beat** is `{ say, do?, hold? }`: `do(k, beat)` makes one visual change, then the recorder waits until `say` has finished + `beatGap`. A beat without `say` lasts `hold` seconds (default 1.5).
- `setup(k)` prepares the first screen before recording starts (`k.present(html)` for generated slides, `k.open(url)` for pages). Keep slow work (fetching data, loading pages) in `setup`, not in `do`.
- If a `do` takes longer than its sentence, the renderer prints a warning — split the beat or move work into `setup`.
- Legacy scenes (`narration` + `run(k)`) still work, but their voice is laid over the whole scene with no sync — prefer beats.

### Kit reference (`k`)
| Helper | Does |
| --- | --- |
| `k.present(html)` | Show a generated slide and start recording (use in `setup`) |
| `k.titleSlide({title, subtitle, footer})` · `k.sectionSlide({kicker, title, body})` · `k.endSlide({line})` | Branded slides |
| `k.bulletSlide({kicker, title, bullets[], footer, steps})` · `k.columnsSlide({kicker, columns:[{title, bullets[]}], steps})` | Lists; `steps:true` hides each item until revealed |
| `k.explainSlide({kicker, title, points:[{title,text}], json, jsonTitle})` | Numbered plain-language points (steps) + optional small JSON pane for `k.mark()` |
| `k.cardsSlide({kicker, title, cards:[{img,title,price,tags}], badge})` | Search box (`k.typeText('#q', …)`) + product cards (steps) + optional badge (step) |
| `k.doc(bodyHtml, css)` | Branded blank page for custom slides/diagrams; give elements `class="step"` + an `id` to reveal them one by one (classes: `.wrap .k h1 h2 p .bar .in .d1…d8 .flow .step`) |
| `k.next(n)` · `k.revealAcross(n, seconds)` · `k.reveal(selector)` | Reveal the next hidden step(s) — the "next slide click" |
| `k.focus(selector)` / `k.focus(null)` | Spotlight: dim every revealed step except this one |
| `k.mark(text \| [texts])` / `k.mark(null)` | Light up the JSON line(s) containing the text (in `#code` or the drawer), fade the rest, scroll to it |
| `k.open(url, {urlBar, removeSelectors})` | Navigate a real page, strip common popups, show a URL bar |
| `k.caption(kicker, title, body)` / `k.hideCaption()` | Animated lower-third |
| `k.highlight(selector, on)` | Outline + scroll into view |
| `k.click(selector, {click})` / `k.type(selector, text)` / `k.typeText(selector, text)` | Visible cursor click / human-speed typing into a real field / into a generated element |
| `k.scroll(px, ms)` / `k.scrollEl(selector, px, ms)` | Smooth scroll page / an element |
| `k.drawer(title, objOrText)` / `k.closeDrawer()` | Slide-in right panel with JSON beside the real page (works with `k.mark`) |
| `k.jsonView(method, url, objOrText)` · `k.terminal(cmd, output, title)` + `k.typeAndRun()` | HTTP response viewer / typed terminal (for technical audiences) |
| `k.show(html)` | Swap to another generated screen without restarting the recording |
| `k.slide(html, seconds)` · `k.start()` | Legacy `run` scenes: timed slide / begin capturing |
| `k.page`, `k.sleep(ms)`, `k.esc`, `k.palette`, `k.state` | Raw Playwright page, utilities, scratch object to pass data from `setup` to beats |

Fetch live data in `setup` (Node 20+ `fetch`) so what's on screen is real.

## Guardrails
- Record only public pages, or logged-in pages the user explicitly provided access for. Never film secrets: `.env` files, API keys, webhook secrets, tokens in URLs. Blur or skip pages that show them.
- Don't perform state-changing actions on live/production systems (saving products, placing orders, rotating secrets) unless the user explicitly approved that specific action.
- No claims on screen or in narration that the product doesn't actually do; label simulations as simulations.
- Don't commit rendered videos into code repositories.
