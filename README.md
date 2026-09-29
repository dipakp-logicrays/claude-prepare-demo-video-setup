# Demo Video

A [Claude Code](https://claude.com/claude-code) skill that turns a demo script into a finished **1080p MP4**: branded slides, real web pages recorded live with captions and highlights, API responses and terminal screens, and, if you ask for it, a **narrated voiceover**.

Ask Claude *"make a demo video of our checkout flow with audio"* and you get a real video instead of a pile of screenshots. It's paced, captioned and narrated, and every render is filed in one central library so you can always find it again, and re-make it.

```
You:    prepare a demo video from DEMO_SCRIPT.md with audio
Claude: → ~/Documents/claude-videos/acme-checkout/checkout-demo-2026-09-29-1020.mp4
          4:05 · 14 scenes · narrated (ryan) · 27.3 MB
          latest:  ~/Documents/claude-videos/acme-checkout/checkout-demo-latest.mp4
          preview: ~/Documents/claude-videos/acme-checkout/preview/checkout-demo-2026-09-29-1020/montage.png
```

---

## Why this exists

Making even a simple product demo video usually means screen-recording software, retakes, a microphone and an editor. This covers the parts that don't need a human:

| Problem | What this does about it |
|---|---|
| Screen recordings are shaky, mistimed and full of popups | Scenes are **scripted**: headless Chrome drives the page, scrolls smoothly, strips cookie banners, and the timing is the same every run |
| Voice and picture drift apart | Scenes are written as **beats**: one sentence plus the one visual step it describes. Each sentence's audio is generated first and measured, and the recording waits for it, so what's said and what's shown always line up |
| Slides dump everything on screen at once | **Click-by-click reveal**: boxes, bullets and cards appear as they're spoken (like pressing *next* in PowerPoint), and a **spotlight** dims everything except the part being explained |
| Walls of JSON nobody can follow | **Line marking** lights up only the lines being talked about; **plain-language cards** and **product cards** for non-technical viewers |
| Viewers don't know what they're looking at | Animated **lower-third captions**, element **highlights** and a visible **cursor** on real pages |
| "What the machine sees" is invisible | Slide-in **JSON panels** next to the live page (structured data, meta tags, API payloads) |
| API demos are unreadable in a raw terminal | **Terminal** and **HTTP response** screens that type the command, then reveal a syntax-highlighted response, with live data |
| Recording a voiceover is a whole session | Optional **neural narration** (Piper, runs locally, free, nothing sent to any service) at a calm ~130 words per minute, loudness-normalized, with a per-video **pronunciation list** |
| One wrong scene means redoing everything | `--only scene-name` re-records just that scene; the rest reuse the cached recording |
| Videos scattered across `~/Desktop` and `/tmp` | Every render filed under `~/Documents/claude-videos/<path>/` |
| The script vanishes when `/tmp` is cleared | The scenes file **and a snapshot of the engine** are archived beside each video, so any render can be reproduced later |

---

## Requirements

| Dependency | Required? | Used for |
|---|---|---|
| **Claude Code** | yes | The skill runs inside it |
| **Chrome or Chromium** | yes | Recording scenes (headless) |
| **ffmpeg** (+ ffprobe) | yes | Encoding, narration mix, stitching |
| **Node.js 20+** | yes | The renderer |
| **python3** with `venv` | for audio | Installs the Piper voice engine in its own venv |

```bash
# Debian / Ubuntu
sudo apt install chromium-browser ffmpeg nodejs python3 python3-venv

# Fedora
sudo dnf install chromium ffmpeg nodejs python3

# macOS
brew install --cask google-chrome
brew install ffmpeg node python
```

The installer also sets up a small runtime in `~/.local/share/claude-demo-video/`: `playwright-core` (to drive your existing Chrome; no browser download), Piper TTS in a private venv, and the default voice (~120 MB).

---

## Install

One line, no clone required:

```bash
curl -s https://raw.githubusercontent.com/dipakp-logicrays/claude-prepare-demo-video-setup/main/lib/onelinesetup | bash
```

That's it. It checks your dependencies, downloads the skill, installs it to `~/.claude/skills/demo-video/`, backs up any existing install first, and installs the runtime. Restart Claude Code afterwards so it picks up the new skill.

Pin a specific version, or skip the runtime download (e.g. you only want silent videos for now):

```bash
curl -s https://raw.githubusercontent.com/dipakp-logicrays/claude-prepare-demo-video-setup/main/lib/onelinesetup | bash -s -- v1.0.0
curl -s https://raw.githubusercontent.com/dipakp-logicrays/claude-prepare-demo-video-setup/main/lib/onelinesetup | bash -s -- main --no-setup
```

<details>
<summary>From a clone</summary>

```bash
git clone https://github.com/dipakp-logicrays/claude-prepare-demo-video-setup.git
cd claude-prepare-demo-video-setup
bash install.sh              # or: bash install.sh --no-setup
```
</details>

<details>
<summary>Fully manual</summary>

```bash
mkdir -p ~/.claude/skills/demo-video
cp skills/demo-video/{SKILL.md,render.js,kit.js,setup.sh,example.scenes.js} ~/.claude/skills/demo-video/
chmod +x ~/.claude/skills/demo-video/{render.js,setup.sh}
bash ~/.claude/skills/demo-video/setup.sh
```
</details>

> **Piping a script to `bash` runs code from the internet.** If you'd rather look first, the script is short and does nothing but download six files and run `install.sh`:
> ```bash
> curl -s https://raw.githubusercontent.com/dipakp-logicrays/claude-prepare-demo-video-setup/main/lib/onelinesetup | less
> ```

### Verify it installed

```bash
ls ~/.claude/skills/demo-video/
node ~/.claude/skills/demo-video/render.js --help
```

Render the bundled example (about a minute, 5 scenes, narrated):

```bash
node ~/.claude/skills/demo-video/render.js ~/.claude/skills/demo-video/example.scenes.js --audio --path examples
xdg-open ~/Documents/claude-videos/examples/example-latest.mp4    # Linux
open      ~/Documents/claude-videos/examples/example-latest.mp4    # macOS
```

---

## How to use it

### Quick start: your first video

**1.** Open Claude Code in any directory:

```bash
claude
```

**2.** Ask for a video. Say what to show, and add *"with audio"* if you want a voiceover:

```
> make a demo video of https://example-store.com: the home page, one product page, and its structured data. With audio.
```

**3.** Claude checks every URL, writes a scenes file, records, narrates, stitches, **looks at the preview contact sheet** to catch problems, and reports:

```
→ ~/Documents/claude-videos/example-store/example-store-2026-09-29-1015.mp4
  1:12 · 5 scenes · narrated (ryan) · 9.8 MB
```

**4.** Open it:

```bash
xdg-open ~/Documents/claude-videos/example-store/example-store-latest.mp4   # Linux
open      ~/Documents/claude-videos/example-store/example-store-latest.mp4   # macOS
```

---

## Examples

### Example 1: the bundled example (no Claude needed)

The skill ships with [`example.scenes.js`](skills/demo-video/example.scenes.js), a 5-scene tour written as beats: a title, a bullet slide that reveals one point per sentence, a live Wikipedia page with highlights, a cursor and its structured data in a side panel (with the lines being discussed lit up), a plain-language explainer beside a live API response, and an end card.

```bash
node ~/.claude/skills/demo-video/render.js ~/.claude/skills/demo-video/example.scenes.js --audio --path examples
```

```
✔ 00_title: recorded …
✔ 01_reveal: recorded …
✔ 02_web-page: recorded …
✔ 03_explain: recorded …
✔ 04_end: recorded …
…
→ ~/Documents/claude-videos/examples/example-<stamp>.mp4
  1:06 · 5 scenes · narrated (ryan) · 3.8 MB
```

Copy it to start your own: `cp ~/.claude/skills/demo-video/example.scenes.js ./my-demo.scenes.js`.

### Example 2: a quick website tour (silent)

In Claude Code:

```
> make a demo video of https://example-store.com — the home page, then the best-selling product page,
  highlight the price and the add-to-cart button. Save it under acme/store-tour.
```

Claude probes the pages, writes the scenes, renders, checks the contact sheet, and reports:

```
→ ~/Documents/claude-videos/acme/store-tour/store-tour-2026-09-29-1015.mp4
  0:48 · 4 scenes · silent · 6.2 MB
```

Silent videos are useful when you'll record your own voiceover in an editor: the per-scene clips in `clips/latest/` are ready to import.

### Example 3: a narrated product demo from your own script

Write the script in any format. Scenes with *on screen* / *say* lines work well:

```markdown
<!-- DEMO_SCRIPT.md -->
# Acme Checkout demo

## 1. Title
On screen: "Acme — checkout in one tap"
Say: Acme lets shoppers check out in one tap, on any store.

## 2. The product page
On screen: https://example-store.com/products/widget — highlight the price, then the "Buy now" button
Say: Here's a normal product page. Shoppers see the price and a single Buy now button.

## 3. What's done
On screen: bullets — one-tap checkout · saved addresses · Apple Pay and Google Pay
Say: So far we've shipped one-tap checkout, saved addresses, and wallet payments.
```

Then:

```
> prepare a demo video from DEMO_SCRIPT.md with audio. Brand color #047857, logo "Acme™", UK female voice.
```

You get a narrated video where each scene lasts as long as its narration, with captions matching what's said:

```
→ ~/Documents/claude-videos/acme-checkout/acme-checkout-2026-09-29-1030.mp4
  1:05 · 3 scenes · narrated (jenny) · 8.4 MB
  preview: ~/Documents/claude-videos/acme-checkout/preview/acme-checkout-2026-09-29-1030/montage.png
```

### Example 4: an API walkthrough, explained simply

Pair a plain-language explanation with the real response, lighting up each line as it's mentioned. For a technical audience, add a typed terminal. A scenes file you (or Claude) might write:

```js
const URL = 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m';

module.exports = {
  slug: 'weather-api',
  brand: { primary: '#1d4ed8', logo: 'Skycast™' },     // the whole palette follows this colour
  pronounce: { Skycast: 'Sky cast' },

  scenes: [
    {
      name: 'intro',
      setup: (k) => k.present(k.sectionSlide({ kicker: 'API', title: 'One request, any city' })),
      beats: [{ say: 'Skycast gives you the weather for any city, with one simple request.' }],
    },
    {
      name: 'explain',
      setup: async (k) => {
        const res = await (await fetch(URL)).json();                      // live data, not a mock
        await k.present(k.explainSlide({
          kicker: 'How it works', title: 'Ask for a place, get the weather',
          points: [{ title: 'You send a place', text: 'Latitude and longitude' }, { title: 'You get the weather', text: 'The temperature right now' }],
          json: res, jsonTitle: 'GET /v1/forecast',
        }));
      },
      beats: [
        { say: 'Here is how it works.' },
        { say: 'You send a place: here, Berlin.', do: async (k) => { await k.next(); await k.mark(['"latitude"', '"longitude"']); } },
        { say: 'And you get the weather back: the temperature right now.', do: async (k) => { await k.next(); await k.mark(['"temperature_2m":', '"temperature_2m":']); } },
      ],
    },
    {
      name: 'terminal',
      setup: async (k) => {
        const res = await (await fetch(URL)).json();
        await k.present(k.terminal(`curl '${URL}'`, res, 'skycast — terminal'));
      },
      beats: [
        { say: 'For developers, it is one line in the terminal.', do: (k) => k.typeAndRun() },   // types the command, then shows the output
        { say: 'The answer comes back in under a second.' },
      ],
    },
  ],
};
```

```bash
node ~/.claude/skills/demo-video/render.js weather-api.scenes.js --audio --name api-walkthrough
# → ~/Documents/claude-videos/weather-api/api-walkthrough-<stamp>.mp4
```

### Example 5: a diagram built up piece by piece

`k.doc()` gives you a branded blank page for any HTML or SVG. Give each part `class="step"` and an `id`, then reveal it in the beat that explains it and spotlight it with `k.focus()`. Dashed lines with `class="flow"` get moving arrows.

```js
{
  name: 'how-it-works',
  setup: (k) => k.present(k.doc(`
    <div class="wrap">
      <div class="k in">How it works</div>
      <svg viewBox="0 0 1500 300" width="1500" style="margin-top:40px;overflow:visible">
        <g id="store" class="step"><rect x="0" y="100" width="340" height="110" rx="16" fill="#063b2e" stroke="#10b981" stroke-width="3"/>
          <text x="170" y="165" text-anchor="middle" font-size="32" fill="#fff">Store</text></g>
        <g id="a1" class="step"><line class="flow" x1="340" y1="155" x2="580" y2="155" stroke="#34d399" stroke-width="4" stroke-dasharray="10 8"/></g>
        <g id="engine" class="step"><rect x="580" y="100" width="340" height="110" rx="16" fill="#047857" stroke="#10b981" stroke-width="3"/>
          <text x="750" y="165" text-anchor="middle" font-size="32" fill="#fff">Engine</text></g>
        <g id="a2" class="step"><line class="flow" x1="920" y1="155" x2="1160" y2="155" stroke="#34d399" stroke-width="4" stroke-dasharray="10 8"/></g>
        <g id="channels" class="step"><rect x="1160" y="100" width="340" height="110" rx="16" fill="#063b2e" stroke="#10b981" stroke-width="3"/>
          <text x="1330" y="165" text-anchor="middle" font-size="32" fill="#fff">Channels</text></g>
      </svg>
    </div>`)),
  beats: [
    { say: 'It starts with your store.', do: async (k) => { await k.reveal('#store'); await k.focus('#store'); } },
    { say: 'Every order goes to our engine,', do: async (k) => { await k.reveal('#a1, #engine'); await k.focus('#engine'); } },
    { say: 'and from there, out to every sales channel.', do: async (k) => { await k.reveal('#a2, #channels'); await k.focus('#channels'); } },
    { say: 'That is the whole picture.', do: (k) => k.focus(null) },                 // un-dim everything
  ],
}
```

### Example 6: updating a video you already made

Every render keeps its source, so changes are one sentence away:

```
> in the acme-checkout video, change the intro narration to "Acme: checkout in one tap, everywhere." and re-render
> re-render only the product-page scene of acme-checkout — the store changed its layout
> make the acme-checkout video silent, I'll record my own voiceover
```

Or by hand:

```bash
$EDITOR ~/Documents/claude-videos/acme-checkout/source/latest/acme-checkout.scenes.js
node ~/.claude/skills/demo-video/render.js \
  ~/Documents/claude-videos/acme-checkout/source/latest/acme-checkout.scenes.js --audio --only intro
```

Only `intro` is re-recorded; every other scene reuses its cached recording, and the narration and final stitch are redone. The result is a new timestamped file, and `acme-checkout-latest.mp4` moves to it.

---

### Through Claude Code (the normal way)

You don't invoke the skill by name; Claude picks it up from what you ask. You can also type `/demo-video`.

| What you type | What happens |
|---|---|
| `make a demo video of <product/site>` | Researches what to show, writes the scenes, renders a **silent** video |
| `… with audio` / `with voiceover` / `narrated` | Same, **narrated** with the default voice |
| `prepare a demo video from DEMO_SCRIPT.md with audio` | Turns your written script into scenes + narration |
| `use a female voice` / `a UK voice` | `amy` / `jenny` (UK) / `alan` (UK) instead of `ryan` |
| `save it under acme/launch, name it launch-demo` | `~/Documents/claude-videos/acme/launch/launch-demo-<stamp>.mp4` |
| `brand color #047857, logo Acme™` | Slides, captions and panels use your brand |
| `change the intro narration to "…" and re-render` | Edits the archived scenes file, re-renders |
| `re-render only the pricing scene` | Re-records one scene; the rest reuse the cache |

### What it can and can't record

| Can | Can't (record these yourself) |
|---|---|
| Public web pages, and API/JSON endpoints | Pages behind a login, **unless** you provide demo credentials or a saved session |
| Generated slides, diagrams (HTML/SVG), terminals | Desktop apps (e.g. Claude Desktop, IDEs) |
| Clicks, typing and scrolling on web pages | Anything needing a physical device |

Claude will not film secrets (`.env` files, API keys, tokens) and will not perform state-changing actions on live systems (saving records, placing orders) unless you explicitly approve that specific action.

### Directly from the shell

The renderer is a plain Node script; you can run it without Claude Code.

```bash
# Render a scenes file into the library (silent)
node ~/.claude/skills/demo-video/render.js my-demo.scenes.js

# Narrated, different voice
node ~/.claude/skills/demo-video/render.js my-demo.scenes.js --audio --voice amy

# Choose the library folder and file name → ~/Documents/claude-videos/acme/launch/launch-demo-<stamp>.mp4
node ~/.claude/skills/demo-video/render.js my-demo.scenes.js --path acme/launch --name launch-demo

# Re-record only two scenes (others reuse the cached recording; narration + stitching are redone)
node ~/.claude/skills/demo-video/render.js my-demo.scenes.js --audio --only intro,pricing

# Write somewhere else entirely
node ~/.claude/skills/demo-video/render.js my-demo.scenes.js --out ~/Desktop/demo.mp4
```

Make it a shortcut if you use it often:

```bash
alias demovideo='node ~/.claude/skills/demo-video/render.js'
# then:  demovideo my-demo.scenes.js --audio
```

### Writing a scenes file

A scenes file is a small CommonJS module. Each scene has a `setup` (the first screen, prepared before recording starts) and a list of **beats**: one sentence the narrator **says**, plus the one visual step it **does**. The recording waits for each sentence to finish, so voice and picture can't drift. Start from [`skills/demo-video/example.scenes.js`](skills/demo-video/example.scenes.js).

```js
module.exports = {
  slug: 'acme-demo',                                   // library folder (overridable with --path)
  name: 'acme-demo',                                   // video file name (overridable with --name)
  brand: { primary: '#047857', logo: 'Acme™' },       // optional; the rest of the palette derives from primary
  pronounce: { Acme: 'Ack me', UCP: 'U C P' },          // how the voice should say words; captions keep the spelling
  voiceSpeed: 1.22,                                    // optional; 1.22 ≈ 130 words per minute (bigger = slower)
  beatGap: 0.8,                                        // optional; seconds of pause after each sentence

  scenes: [
    {
      name: 'why',
      setup: (k) => k.present(k.bulletSlide({ title: 'Why Acme', steps: true, bullets: ['Fast', 'Simple'] })),
      beats: [
        { say: 'Why do people choose Acme?' },                         // nothing new on screen yet
        { say: 'First, it is fast.', do: (k) => k.next() },            // bullet 1 appears as it is said
        { say: 'And second, it is simple.', do: (k) => k.next() },     // bullet 2
      ],
    },
    {
      name: 'product-page',
      setup: (k) => k.open('https://example-store.com/product/1'),    // page loads before recording starts
      beats: [
        { say: 'This is a product page.', do: (k) => k.caption('Product page', 'What people see') },
        { say: 'Here is the price.', do: (k) => k.highlight('.price') },
        { say: 'And this is what a computer reads from it.', do: (k) => k.drawer('Structured data', { '@type': 'Product', name: 'Widget', price: '9.99' }) },
        { say: 'Its name, and its price.', do: (k) => k.mark(['"name"', '"price"']) },
      ],
    },
  ],
};
```

- A beat is `{ say, do?, hold? }`. `do(k, beat)` makes one visual change; `beat.duration` is that sentence's length, useful for `k.revealAcross(n, beat.duration)` when one sentence lists several items. A beat without `say` lasts `hold` seconds.
- Keep slow work (fetching data, loading pages) in `setup`. If a `do` takes longer than its sentence, the renderer prints a warning.
- Older scenes written as `narration` + `run(k)` still render, but their voice isn't synced to the picture.

**The kit (`k`)** available in `setup` and every `do`:

| Helper | Does |
|---|---|
| `k.present(html)` | Show a generated slide and start recording (use in `setup`) |
| `k.titleSlide` · `k.sectionSlide` · `k.endSlide` | Branded title, section and closing slides |
| `k.bulletSlide({…, steps})` · `k.columnsSlide({…, steps})` | Lists; `steps: true` hides each item until it's revealed |
| `k.explainSlide({kicker, title, points, json, jsonTitle})` | Numbered plain-language points + an optional small JSON pane |
| `k.cardsSlide({kicker, title, cards, badge})` | A search box (`k.typeText('#q', …)`) and product cards with image, name, price |
| `k.doc(bodyHtml, css)` | Branded blank page for custom slides and SVG diagrams (`class="step"` parts reveal one by one) |
| `k.next(n)` · `k.revealAcross(n, seconds)` · `k.reveal(selector)` | Reveal the next hidden item(s): the "next click" |
| `k.focus(selector)` · `k.focus(null)` | Spotlight one part, dim the rest / clear |
| `k.mark(text \| [texts])` · `k.mark(null)` | Light up the JSON lines containing the text, fade the rest, scroll to them |
| `k.open(url)` | Load a real page (popups stripped, URL bar shown) |
| `k.caption(kicker, title, body)` · `k.hideCaption()` | Animated lower-third |
| `k.highlight(selector)` · `k.click(selector)` · `k.type(selector, text)` | Outline, cursor-click, human-speed typing |
| `k.scroll(px, ms)` · `k.scrollEl(selector, px, ms)` | Smooth scrolling of the page or a panel |
| `k.drawer(title, json)` | Slide-in JSON panel beside the live page |
| `k.jsonView(method, url, json)` · `k.terminal(cmd, output)` + `k.typeAndRun()` | Full-screen HTTP response viewer / typed terminal |
| `k.show(html)` | Switch screens mid-scene without restarting the recording |
| `k.page` · `k.state` | The raw Playwright page / a scratch object to pass data from `setup` to beats |

Fetch live data in `setup` (Node's built-in `fetch`) so what's on screen is real. The full reference, including tips on writing for non-technical viewers, is in [`SKILL.md`](skills/demo-video/SKILL.md).

### Narration

- **Silent by default.** A silent audio track is still included so video editors import it cleanly. Pass `--audio` (or say *"with audio"*) for narration.
- **Voices:** `ryan` (default, US male), `amy`, `lessac`, `libritts`, `alan` (UK male), `jenny` (UK female). Extra voices download on demand: `bash ~/.claude/skills/demo-video/setup.sh amy`.
- **Pace:** about 130 words per minute with a short pause after every sentence. Slow it further with `voiceSpeed: 1.35`; for a dense scene, split long sentences into more beats rather than speeding up.
- **In sync by construction:** every sentence is generated and measured *before* recording, the recording waits for it, and its audio is placed exactly where its beat started.
- **Pronunciation:** add words to `pronounce`, e.g. `{ Goofre: 'go free', 'llms.txt': 'L-L-M-s dot text', UCP: 'U C P' }`. Matching is whole-word and case-insensitive; captions keep the real spelling.
- **Re-renders are cheap:** audio for unchanged sentences is reused, and a scene is only re-recorded when its narration changed or you name it in `--only`.

### What "good output" looks like

Open `preview/latest/montage.png` (one frame per scene) and check:

- [ ] No cookie banners or popups covering content
- [ ] No blank, error or login pages where content should be
- [ ] Captions don't cover the thing being shown
- [ ] JSON panels are readable (dark background, colored text)
- [ ] Custom slides have no overlapping text

Fix the scene and re-render just it with `--only <scene>`.

---

## Where files go

```
~/Documents/claude-videos/
└── acme-checkout/                                   ← --path, else the scenes file's slug
    ├── checkout-demo-2026-09-29-1015.mp4            ← one file per render, never overwritten
    ├── checkout-demo-2026-09-29-1020.mp4
    ├── checkout-demo-latest.mp4                     ← symlink to the newest
    ├── source/                                      ← everything needed to re-make a render
    │   ├── checkout-demo-2026-09-29-1020/
    │   │   ├── checkout-demo.scenes.js              ← the scenes: edit this and re-render
    │   │   ├── narration.json                       ← narration text per scene
    │   │   ├── engine/                              ← snapshot of render.js, kit.js, setup.sh
    │   │   └── README.md                            ← the exact re-render command
    │   └── latest -> checkout-demo-2026-09-29-1020
    ├── clips/                                       ← each finished scene, with its audio
    │   ├── checkout-demo-2026-09-29-1020/00_title.mp4 … 13_end.mp4
    │   └── latest -> checkout-demo-2026-09-29-1020
    ├── preview/
    │   ├── checkout-demo-2026-09-29-1020/
    │   │   ├── montage.png                          ← contact sheet, one frame per scene
    │   │   ├── TIMELINE.txt                         ← start time, length and narration per scene
    │   │   └── 00_title.jpg …
    │   └── latest -> checkout-demo-2026-09-29-1020
    └── .work/checkout-demo/                         ← recording cache used by --only
```

- **Missing directories are created automatically.**
- **Renders are never overwritten.** Each gets a timestamp; two runs in the same minute get `-2`, `-3` suffixes.
- **`<name>-latest.mp4`** always points at the newest render. It's a relative symlink, so moving the folder doesn't break it.
- **Per-scene clips** in `clips/` are ready to drop into a video editor if you want to reorder, trim, or add music.

### Why the source is kept

Scenes files are written into Claude Code's scratchpad under `/tmp`, which is cleared between sessions and on reboot. Once that happens, a video in your library has no source: you can't fix a typo in the narration or update a scene after the product changes.

Archiving the scenes file, the narration and a snapshot of the engine beside each render makes every video reproducible:

```bash
# Tweak the narration months later and re-render
$EDITOR ~/Documents/claude-videos/acme-checkout/source/latest/checkout-demo.scenes.js
node ~/.claude/skills/demo-video/render.js \
  ~/Documents/claude-videos/acme-checkout/source/latest/checkout-demo.scenes.js --audio

# See what changed between two renders
diff -r ~/Documents/claude-videos/acme-checkout/source/checkout-demo-2026-09-29-{1015,1020}
```

The engine snapshot means an old render can still be reproduced exactly even after the skill itself has been updated (`node source/<render>/engine/render.js …`).

### Changing the location

```bash
# One-off
CLAUDE_VIDEO_DIR=~/Dropbox/videos node ~/.claude/skills/demo-video/render.js my-demo.scenes.js

# Permanent: add to ~/.bashrc or ~/.zshrc
export CLAUDE_VIDEO_DIR="$HOME/Dropbox/videos"
```

---

## Options

| Argument | Meaning |
|---|---|
| `<scenes.js>` | **Required.** The scenes file |
| `--audio` | Narrate each scene (silent by default) |
| `--voice <name>` | `ryan` (default), `amy`, `lessac`, `libritts`, `alan`, `jenny` |
| `--only <a,b>` | Re-record only these scenes (by name); others reuse the cached recording |
| `--path <dir>` | Library sub-folder (default: the scenes file's `slug`) |
| `--name <video_name>` | Output file name (default: the scenes file's `name`) |
| `--out <dir\|file.mp4>` | Write outside the library |
| `--no-source` | Don't archive the scenes file and engine into `source/` |

| Environment variable | Default | Meaning |
|---|---|---|
| `CLAUDE_VIDEO_DIR` | `~/Documents/claude-videos` | Root of the video library |
| `CLAUDE_DEMO_VIDEO_DATA` | `~/.local/share/claude-demo-video` | Runtime: playwright-core, Piper venv, voices |
| `CHROME_PATH` | auto-detected | Chrome/Chromium binary to record with |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Where `install.sh` puts the skill |

---

## How it works

1. **Speak first.** With `--audio`, Piper turns every beat's sentence into audio, applying the `pronounce` list, and measures it. Without audio, each beat's length is estimated from its word count.
2. **Record to the voice.** For each scene, `render.js` opens a fresh 1920×1080 headless Chrome context, runs `setup`, then for every beat runs its visual step and waits until that sentence has been spoken plus a short pause. Frames come from the Chrome DevTools **screencast**, timed on a monotonic clock so a laptop sleeping mid-render can't stretch a scene into hours. ffmpeg turns them into constant 30 fps H.264.
3. **Place the audio.** Each sentence is placed at the exact moment its beat started, mixed, loudness-normalized to −16 LUFS, and faded at the scene edges.
4. **Stitch.** Finished scenes are concatenated without re-encoding into the final MP4 (`+faststart`, so it streams in browsers).
5. **File.** The video, per-scene clips, contact sheet, timeline and source archive are written into the library, and the `latest` links are updated.

---

## Troubleshooting

**One-liner fails with "Could not download …"**
The raw URLs only work on a **public** repo. If yours is private, make it public or use the clone install (`git clone` honours your SSH keys). Also check the ref exists; the default is `main`.

**"No Chrome/Chromium found"**
Install Chrome or Chromium, or point `CHROME_PATH` at the binary. The renderer looks for `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser` on `PATH`, and the standard macOS app locations.

**"playwright-core missing" / "narration needs Piper"**
Run `bash ~/.claude/skills/demo-video/setup.sh` (add a voice name to fetch that voice).

**A cookie banner or popup covers the page**
Pass its selector to `k.open(url, { removeSelectors: ['.my-banner'] })`, or remove it with `k.page.evaluate(...)` before `k.start()`.

**JSON panel text is hard to read on some sites**
The host page's CSS is leaking in. The panel already forces its own colors with `!important`; if a site still wins, add a more specific rule via `k.page.addStyleTag(...)`.

**"a beat's visuals took Xs but its narration is Ys"**
That beat's `do` is slower than its sentence (usually a page load or data fetch). Move the slow work into the scene's `setup`, or split the beat.

**Voice and picture don't line up**
The scene is written in the older `narration` + `run` style, which lays the voice over the whole scene. Rewrite it as beats.

**The voice mispronounces a name**
Respell it phonetically in `narration` only (e.g. `"Acmay"`). Captions keep the real spelling.

**"scene ran …s — over the 300s limit"**
A scene hung or ran away. If it's genuinely that long, set `maxSceneSeconds` in the scenes file.

**Claude doesn't use the skill**
Restart Claude Code so it rescans `~/.claude/skills/`. Confirm the files are at `~/.claude/skills/demo-video/SKILL.md`.

---

## Repo layout

```
.
├── README.md
├── install.sh                      # dependency check + copy into ~/.claude/skills/ + runtime setup
├── lib/
│   └── onelinesetup                # curl | bash bootstrap → downloads, then runs install.sh
└── skills/
    └── demo-video/
        ├── SKILL.md                # instructions Claude Code reads
        ├── render.js               # the renderer: record → narrate → stitch → file
        ├── kit.js                  # scene helpers: slides, captions, panels, terminal
        ├── setup.sh                # runtime: playwright-core, Piper TTS, voices
        └── example.scenes.js       # a 5-scene template showing every kind of scene
```

### Uninstall

```bash
rm -rf ~/.claude/skills/demo-video ~/.local/share/claude-demo-video
```

Your videos in `~/Documents/claude-videos/` are left alone.
