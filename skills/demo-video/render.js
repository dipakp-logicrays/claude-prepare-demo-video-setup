#!/usr/bin/env node
// Demo video renderer — records a scenes file with headless Chrome, optionally narrates it, and files it in the library.
//
//   node render.js <scenes.js> [--audio] [--voice ryan] [--only a,b] [--path <dir>] [--name <video_name>]
//                              [--out <dir|file.mp4>] [--no-source]
//
// Library (default ~/Documents/claude-videos, override with $CLAUDE_VIDEO_DIR):
//   <path>/<name>-YYYY-MM-DD-HHMM.mp4, <name>-latest.mp4 → newest,
//   source/, clips/<render>/, preview/<render>/{montage.png,TIMELINE.txt}, preview/latest, .work/<name>/ (recording cache)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const DATA = process.env.CLAUDE_DEMO_VIDEO_DATA || path.join(os.homedir(), '.local/share/claude-demo-video');
const LIB = process.env.CLAUDE_VIDEO_DIR || path.join(os.homedir(), 'Documents/claude-videos');
const CHROME = process.env.CHROME_PATH || findChrome();

function findChrome() {
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const r = spawnSync('sh', ['-c', `command -v ${bin}`]);
    if (r.status === 0) return r.stdout.toString().trim();
  }
  return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((p) => fs.existsSync(p));
}
const FADE = 0.35, LEAD = 0.5, TAIL = 0.9;
// Beat scenes: silence before the first beat, pause between beats, hold after the last one (seconds)
const B_LEAD = 0.7, B_TAIL = 1.4;

// ---------- args ----------
const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  console.log(`usage: render.js <scenes.js> [options]

  --audio              narrate each scene with Piper (silent by default)
  --voice <name>       ryan (default) | amy | lessac | libritts | alan | jenny
  --only <a,b>         re-record only these scenes; the rest reuse the cached recording
  --path <dir>         library sub-folder (default: the scenes file's slug)
  --name <video_name>  output file name (default: the scenes file's name)
  --out <dir|file.mp4> write somewhere other than the library
  --no-source          don't archive the scenes file + engine into source/

Library: ${LIB}`);
  process.exit(0);
}
const opt = { audio: false, voice: 'ryan', only: null, path: null, name: null, out: null, source: true };
let scenesFile = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--audio') opt.audio = true;
  else if (a === '--no-source') opt.source = false;
  else if (['--voice', '--only', '--path', '--name', '--out'].includes(a)) opt[a.slice(2)] = argv[++i];
  else if (!scenesFile) scenesFile = path.resolve(a);
  else die(`unexpected argument: ${a}`);
}
if (!scenesFile || !fs.existsSync(scenesFile)) die('usage: render.js <scenes.js> [--audio] [--voice ryan] [--only a,b] [--path dir] [--name video_name] [--out dir|file.mp4]');
if (!CHROME) die('No Chrome/Chromium found (set CHROME_PATH).');

let chromium;
try { ({ chromium } = require(path.join(DATA, 'node_modules/playwright-core'))); } catch { die(`playwright-core missing — run: bash ${path.join(__dirname, 'setup.sh')}`); }

const PIPER = path.join(DATA, 'tts/venv/bin/piper');
const VOICE = path.join(DATA, 'tts/voices', `${opt.voice}.onnx`);
if (opt.audio && (!fs.existsSync(PIPER) || !fs.existsSync(VOICE))) die(`narration needs Piper + the "${opt.voice}" voice — run: bash ${path.join(__dirname, 'setup.sh')} ${opt.voice}`);

const { makeKit } = require('./kit');
const spec = require(scenesFile);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const baseSlug = slug(spec.slug || path.basename(scenesFile, '.js'));
const name = slug(opt.name || spec.name || baseSlug);
const scenes = spec.scenes || [];
if (!scenes.length) die('scenes file exports no scenes');
scenes.forEach((s, i) => { s.id = `${String(i).padStart(2, '0')}_${slug(s.name || 'scene')}`; });

// ---------- output locations ----------
const stamp = (() => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; })();
let libDir, outFile, library = true;
if (opt.out && opt.out.endsWith('.mp4')) { outFile = path.resolve(opt.out); libDir = path.dirname(outFile); library = false; }
else {
  libDir = opt.out ? path.resolve(opt.out) : path.join(LIB, opt.path || baseSlug);
  let render = `${name}-${stamp}`, n = 2;
  while (fs.existsSync(path.join(libDir, render + '.mp4'))) render = `${name}-${stamp}-${n++}`;
  outFile = path.join(libDir, render + '.mp4');
}
const render = path.basename(outFile, '.mp4');
const WORK = path.join(libDir, '.work', name);
const RAW = path.join(WORK, 'raw'), FRAMES = path.join(WORK, 'frames');
const CLIPS = library ? path.join(libDir, 'clips', render) : path.join(WORK, 'clips');
const PREVIEW = library ? path.join(libDir, 'preview', render) : path.join(WORK, 'preview');
[libDir, RAW, FRAMES, CLIPS, PREVIEW].forEach((d) => fs.mkdirSync(d, { recursive: true }));

function die(m) { console.error(`✘ ${m}`); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
const link = (target, at) => { try { fs.unlinkSync(at); } catch {} fs.symlinkSync(target, at); };
const crypto = require('crypto');
const hash = (t) => crypto.createHash('sha1').update(t).digest('hex').slice(0, 12);

// ---------- speech ----------
// `pronounce` maps written words to how the voice should say them ({ Goofre: 'go free' }); captions are untouched.
function spoken(text) {
  let out = text;
  for (const [from, to] of Object.entries(spec.pronounce || {})) {
    const re = new RegExp(`(?<![\\w.])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'gi');
    out = out.replace(re, to);
  }
  return out;
}
const SPEED = () => String(spec.voiceSpeed || 1.22);
function synth(text, wav) {
  const r = spawnSync(PIPER, ['-m', VOICE, '-f', wav, '--sentence-silence', String(spec.sentencePause ?? 0.5), '--length-scale', SPEED()], { input: spoken(text) });
  if (r.status !== 0) die(`piper failed: ${r.stderr}`);
}
// Each beat's audio is made BEFORE recording, so the recording can wait exactly as long as the sentence takes.
// Files are reused while the text, voice and speed are unchanged.
function prepareBeats(scene) {
  const dir = path.join(WORK, 'beats'); fs.mkdirSync(dir, { recursive: true });
  scene.beats.forEach((b, i) => {
    b.key = hash([b.say || '', opt.audio ? opt.voice : 'silent', SPEED(), JSON.stringify(spec.pronounce || {})].join('|'));
    if (!b.say) { b.duration = b.hold || 1.5; return; }
    if (!opt.audio) { b.duration = b.say.split(/\s+/).length / 2.3 + 0.3; return; }
    b.wav = path.join(dir, `${scene.id}-${i}-${b.key}.wav`);
    if (!fs.existsSync(b.wav)) synth(b.say, b.wav);
    b.duration = dur(b.wav);
  });
}

// ---------- source archive: everything needed to reproduce this render ----------
// source/<render>/ holds the scenes file, a snapshot of the engine, the narration text and a README.
// Scratchpad copies get wiped when the session ends, so without this a render can't be re-made or tweaked later.
function archiveSource() {
  const root = path.join(libDir, 'source');
  const dir = path.join(root, render);
  fs.mkdirSync(path.join(dir, 'engine'), { recursive: true });
  fs.copyFileSync(scenesFile, path.join(dir, `${name}.scenes.js`));
  for (const f of ['render.js', 'kit.js', 'setup.sh']) fs.copyFileSync(path.join(__dirname, f), path.join(dir, 'engine', f));
  fs.writeFileSync(path.join(dir, 'narration.json'), JSON.stringify(Object.fromEntries(scenes.map((s) => [s.id, s.narration || ''])), null, 2) + '\n');
  const flags = [opt.audio ? '--audio' : '', opt.audio && opt.voice !== 'ryan' ? `--voice ${opt.voice}` : '', opt.path ? `--path ${opt.path}` : '', opt.name ? `--name ${opt.name}` : ''].filter(Boolean).join(' ');
  fs.writeFileSync(path.join(dir, 'README.md'), `# ${render}

Source for \`${path.basename(outFile)}\` — ${scenes.length} scenes, ${opt.audio ? `narrated (${opt.voice})` : 'silent'}.

| File | What |
| --- | --- |
| \`${name}.scenes.js\` | The scenes: what's on screen and the narration for each |
| \`narration.json\` | Narration text per scene (read-only copy, for review) |
| \`engine/\` | Snapshot of the demo-video skill that rendered this (render.js, kit.js, setup.sh) |

## Re-render
Edit \`${name}.scenes.js\`, then:

\`\`\`bash
node ~/.claude/skills/demo-video/render.js "${path.join(dir, `${name}.scenes.js`)}" ${flags}
\`\`\`

If the skill has changed since and the output differs, run the snapshot instead: \`node engine/render.js …\`
(it needs \`bash engine/setup.sh\` to have been run once).
`);
  link(render, path.join(root, 'latest'));
  console.log(`  source:  ${dir}`);
}

// ---------- recording ----------
let browser;
async function record(scene) {
  browser ||= await chromium.launch({ executablePath: CHROME, args: ['--hide-scrollbars', '--font-render-hinting=none', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, ...(spec.context || {}) });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const dir = path.join(FRAMES, scene.id);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  // Frame times come from a monotonic clock (performance.now) taken on receipt, not CDP wall-clock timestamps,
  // so a laptop suspending mid-scene doesn't turn into hours of frozen video.
  const frames = []; let on = false, started = false, tEnd = 0;
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    if (!on) return;
    const f = path.join(dir, String(frames.length).padStart(6, '0') + '.jpg');
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    frames.push({ f, t: performance.now() / 1000 });
  });
  const start = async () => {
    if (started) return; started = true;
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080 });
    on = true; await sleep(80);
  };
  const k = makeKit(page, start, spec.brand);
  const gap = spec.beatGap ?? 0.8;
  try {
    if (spec.setup) await spec.setup(k, scene);
    if (scene.beats) {
      // Picture follows the voice: each beat's visual step runs, then we wait until its sentence has been spoken.
      if (scene.setup) await scene.setup(k);
      await start();
      await sleep(B_LEAD * 1000);
      for (const b of scene.beats) {
        b.t = performance.now() / 1000;
        if (b.do) await b.do(k, b);
        const spent = performance.now() / 1000 - b.t;
        if (spent > b.duration + gap) console.log(`  ! ${scene.id}: a beat's visuals took ${spent.toFixed(1)}s but its narration is ${b.duration.toFixed(1)}s`);
        await sleep(Math.max(0, b.duration + gap - spent) * 1000);
      }
      await sleep(B_TAIL * 1000);
    } else {
      await scene.run(k);
    }
    if (!started) throw new Error('scene never called k.start() or k.slide()');
  } finally { tEnd = performance.now() / 1000; on = false; await cdp.send('Page.stopScreencast').catch(() => {}); await ctx.close(); }
  if (!frames.length) throw new Error('no frames captured');
  const endTs = tEnd;
  if (endTs - frames[0].t > (spec.maxSceneSeconds || 300)) throw new Error(`scene ran ${(endTs - frames[0].t).toFixed(0)}s — over the ${spec.maxSceneSeconds || 300}s limit (set maxSceneSeconds to allow longer)`);
  let list = '';
  frames.forEach((fr, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(endTs, fr.t + 0.5);
    list += `file '${fr.f}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}\n`;
  });
  list += `file '${frames[frames.length - 1].f}'\n`;
  fs.writeFileSync(path.join(dir, 'list.txt'), list);
  if (scene.beats) {
    scene.beats.forEach((b) => { b.offset = Math.max(0, b.t - frames[0].t); });
    fs.writeFileSync(path.join(RAW, scene.id + '.beats.json'), JSON.stringify(scene.beats.map((b) => ({ key: b.key, offset: b.offset, duration: b.duration }))));
  }
  const out = path.join(RAW, scene.id + '.mp4');
  ff('-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', out);
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

// ---------- finishing: narration / fades / silent track ----------
function finish(scene) {
  const raw = path.join(RAW, scene.id + '.mp4');
  const out = path.join(CLIPS, scene.id + '.mp4');
  const v = dur(raw);
  let total = v, audioIn, af;
  if (scene.beats && opt.audio && scene.beats.some((b) => b.wav)) {
    // Each sentence starts exactly where its beat started in the recording.
    const voiced = scene.beats.filter((b) => b.wav);
    const last = voiced[voiced.length - 1];
    scene.speech = voiced.reduce((a, b) => a + b.duration, 0);
    total = Math.max(v, last.offset + last.duration + 0.5);
    audioIn = voiced.flatMap((b) => ['-i', b.wav]);
    const parts = voiced.map((b, i) => `[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(b.offset * 1000)}:all=1[b${i}]`);
    const mix = voiced.length > 1 ? `${voiced.map((_, i) => `[b${i}]`).join('')}amix=inputs=${voiced.length}:normalize=0:duration=longest[m]` : '[b0]anull[m]';
    af = `${parts.join(';')};${mix};[m]loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad,atrim=0:${total.toFixed(3)},afade=t=out:st=${(total - FADE).toFixed(3)}:d=${FADE}[a]`;
  } else if (opt.audio && scene.narration && !scene.beats) {
    const wav = path.join(WORK, scene.id + '.wav');
    synth(scene.narration, wav);
    scene.speech = dur(wav);
    total = Math.max(v, LEAD + scene.speech + TAIL);
    audioIn = ['-i', wav];
    af = `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${LEAD * 1000}:all=1,loudnorm=I=-16:TP=-1.5:LRA=11,apad,atrim=0:${total.toFixed(3)},afade=t=out:st=${(total - FADE).toFixed(3)}:d=${FADE}[a]`;
  } else {
    audioIn = ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'];
    af = `[1:a]atrim=0:${total.toFixed(3)}[a]`;
  }
  scene.hold = total - v;
  const vf = `[0:v]tpad=stop_mode=clone:stop_duration=${scene.hold.toFixed(3)},fade=t=in:st=0:d=${FADE},fade=t=out:st=${(total - FADE).toFixed(3)}:d=${FADE}[v]`;
  ff('-i', raw, ...audioIn, '-filter_complex', `${vf};${af}`, '-map', '[v]', '-map', '[a]', '-r', '30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', out);
  scene.duration = dur(out);
  return out;
}

(async () => {
  const only = opt.only ? new Set(opt.only.split(',').map(slug)) : null;
  for (const s of scenes) if (s.beats) { prepareBeats(s); s.narration = s.beats.map((b) => b.say).filter(Boolean).join(' '); }
  for (const s of scenes) {
    const cached = path.join(RAW, s.id + '.mp4');
    let want = !only || only.has(slug(s.name)) || only.has(s.id);
    if (!want && s.beats) {
      // A cached beat recording is only reusable if every sentence is unchanged (same text, voice, speed).
      const meta = path.join(RAW, s.id + '.beats.json');
      const saved = fs.existsSync(meta) ? JSON.parse(fs.readFileSync(meta)) : null;
      if (saved && saved.length === s.beats.length && saved.every((x, i) => x.key === s.beats[i].key)) saved.forEach((x, i) => { s.beats[i].offset = x.offset; });
      else if (fs.existsSync(cached)) { console.log(`· ${s.id}: narration changed — re-recording`); want = true; }
    }
    if (!want && fs.existsSync(cached)) { console.log(`· ${s.id}: reusing recording`); continue; }
    if (!want) console.log(`· ${s.id}: no cached recording — recording anyway`);
    try { await record(s); console.log(`✔ ${s.id}: recorded ${dur(cached).toFixed(1)}s`); }
    catch (e) { if (browser) await browser.close(); die(`${s.id}: ${e.message}`); }
  }
  if (browser) await browser.close();

  const parts = scenes.map((s) => {
    const f = finish(s);
    console.log(`✔ ${s.id}: ${s.duration.toFixed(1)}s` + (s.speech ? ` (speech ${s.speech.toFixed(1)}s${s.hold > 0.05 ? `, held last frame ${s.hold.toFixed(1)}s` : ''})` : ''));
    return f;
  });
  const lst = path.join(WORK, 'concat.txt');
  fs.writeFileSync(lst, parts.map((f) => `file '${f}'\n`).join(''));
  ff('-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', outFile);

  // timeline + contact sheet
  let t = 0, tl = `${path.basename(outFile)} — ${opt.audio ? 'narrated' : 'silent'} — ${scenes.length} scenes\n\n`;
  const thumbs = [];
  scenes.forEach((s) => {
    tl += `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}  ${s.id.padEnd(28)} ${s.duration.toFixed(1).padStart(5)}s  ${(s.narration || '').slice(0, 90)}${(s.narration || '').length > 90 ? '…' : ''}\n`;
    const th = path.join(PREVIEW, s.id + '.jpg');
    ff('-ss', String(Math.min(s.duration - FADE - 0.1, Math.max(1, s.duration * 0.6))), '-i', path.join(CLIPS, s.id + '.mp4'), '-frames:v', '1', '-vf', 'scale=640:-1', th);
    thumbs.push(th); t += s.duration;
  });
  fs.writeFileSync(path.join(PREVIEW, 'TIMELINE.txt'), tl);
  const cols = 3, rows = Math.ceil(thumbs.length / cols);
  ff('-framerate', '1', '-pattern_type', 'glob', '-i', path.join(PREVIEW, '*.jpg'), '-vf', `tile=${cols}x${rows}:padding=8:color=black`, '-frames:v', '1', path.join(PREVIEW, 'montage.png'));

  if (library) {
    link(path.basename(outFile), path.join(libDir, `${name}-latest.mp4`));
    link(render, path.join(libDir, 'preview', 'latest'));
    link(render, path.join(libDir, 'clips', 'latest'));
    if (opt.source) archiveSource();
  }
  console.log(`\n→ ${outFile}\n  ${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')} · ${scenes.length} scenes · ${opt.audio ? `narrated (${opt.voice})` : 'silent'} · ${(fs.statSync(outFile).size / 1e6).toFixed(1)} MB`);
  if (library) console.log(`  latest:  ${path.join(libDir, `${name}-latest.mp4`)}`);
  console.log(`  preview: ${path.join(PREVIEW, 'montage.png')}\n  timeline: ${path.join(PREVIEW, 'TIMELINE.txt')}`);
})();
