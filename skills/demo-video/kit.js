// Scene kit: overlays for real pages + slide / JSON / terminal templates.
// Every helper is bound to the scene's page; scenes receive it as `k`.
const W = 1920, H = 1080;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Colours: pass just `primary` and the rest of the palette (dark backgrounds, accents, text) is derived
// from its hue. Any key can still be set explicitly. The default green keeps its hand-tuned values.
function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: s * 100 };
}
function hslHex(h, s, l) {
  s /= 100; l /= 100;
  const f = (n) => { const k = (n + h / 30) % 12, c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function palette(brand = {}) {
  const primary = brand.primary || '#047857';
  const hsl = primary.toLowerCase() === '#047857' ? null : hexToHsl(primary);
  const d = hsl
    ? { accent: hslHex(hsl.h, Math.min(hsl.s, 80), 45), light: hslHex(hsl.h, Math.min(hsl.s, 75), 72), text: hslHex(hsl.h, 40, 95),
        muted: hslHex(hsl.h, 25, 84), bg: hslHex(hsl.h, Math.min(hsl.s, 70), 8), bgDeep: hslHex(hsl.h, Math.min(hsl.s, 70), 5), bgGlow: hslHex(hsl.h, Math.min(hsl.s, 80), 22) }
    : { accent: '#10b981', light: '#6ee7b7', text: '#ecfdf5', muted: '#c9ede0', bg: '#04201a', bgDeep: '#021410', bgGlow: '#065f46' };
  return {
    primary,
    accent: brand.accent || d.accent,        // dots, outlines, arrows
    light: brand.light || d.light,           // kickers, labels
    text: brand.text || d.text,
    muted: brand.muted || d.muted,
    bg: brand.bg || d.bg,                    // dark panels
    bgDeep: brand.bgDeep || d.bgDeep,
    bgGlow: brand.bgGlow || d.bgGlow,
    font: brand.font || 'Inter,system-ui,-apple-system,Segoe UI,sans-serif',
    logo: brand.logo || null,                // plain text wordmark, e.g. "Acme™"
  };
}

function highlightJson(obj) {
  return esc(JSON.stringify(obj, null, 2)).replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (m) => {
      let c = 'jn';
      if (/^"/.test(m)) c = /:$/.test(m) ? 'jk' : 'js';
      else if (/true|false|null/.test(m)) c = 'jb';
      return `<span class="${c}">${m}</span>`;
    });
}

const JSON_CSS = `.jk{color:#93c5fd}.js{color:#86efac}.jn{color:#fcd34d}.jb{color:#f9a8d4}`;

function overlayCss(p) {
  return `
#dv-cap{position:fixed;left:48px;bottom:48px;max-width:1000px;z-index:2147483647;text-align:left;font-family:${p.font};color:#fff;
  background:${p.bg}e6;backdrop-filter:blur(8px);border-left:6px solid ${p.accent};border-radius:14px;padding:22px 30px;
  box-shadow:0 20px 60px rgba(0,0,0,.35);opacity:0;transform:translateY(16px);transition:all .5s ease}
#dv-cap.on{opacity:1;transform:none}
#dv-cap .k{font-size:17px;letter-spacing:.14em;text-transform:uppercase;color:${p.light};font-weight:700;margin-bottom:6px}
#dv-cap .t{font-size:34px;font-weight:800;line-height:1.2}
#dv-cap .b{font-size:23px;line-height:1.45;color:${p.text};margin-top:8px}
#dv-url{position:fixed;top:0;left:0;right:0;height:52px;z-index:2147483646;background:${p.primary};color:${p.text};
  font:500 20px ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;align-items:center;padding:0 24px;gap:14px}
#dv-url i{width:12px;height:12px;border-radius:50%;background:${p.light};display:inline-block}
.dv-hl{outline:4px solid ${p.accent} !important;outline-offset:6px;border-radius:6px;box-shadow:0 0 0 12px ${p.accent}38 !important;transition:all .3s}
#dv-drawer{position:fixed;top:52px;right:0;bottom:0;width:820px;z-index:2147483645;text-align:left;background:${p.bg} !important;
  box-shadow:-20px 0 60px rgba(0,0,0,.4);transform:translateX(100%);transition:transform .7s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column}
#dv-drawer.on{transform:none}
#dv-drawer h3{margin:0;padding:22px 28px;font:700 22px ${p.font};color:${p.light};border-bottom:1px solid ${p.bgGlow}}
#dv-drawer pre,#dv-drawer pre *{font:18px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace !important;opacity:1 !important}
#dv-drawer pre{margin:0;padding:22px 28px;overflow:hidden;white-space:pre-wrap;word-break:break-word;flex:1;
  color:${p.text} !important;background:${p.bg} !important;border:0 !important;box-shadow:none !important}
#dv-drawer .jk{color:#93c5fd !important}#dv-drawer .js{color:#86efac !important}#dv-drawer .jn{color:#fcd34d !important}#dv-drawer .jb{color:#f9a8d4 !important}
#dv-cursor{position:fixed;z-index:2147483647;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;pointer-events:none;
  background:${p.accent}55;border:3px solid ${p.accent};transition:left .6s cubic-bezier(.2,.8,.2,1),top .6s cubic-bezier(.2,.8,.2,1),transform .15s}
#dv-cursor.click{transform:scale(.6)}`;
}

function slideCss(p) {
  return `*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font-family:${p.font};background:radial-gradient(1200px 700px at 80% -10%,${p.bgGlow} 0%,${p.bg} 55%,${p.bgDeep} 100%);color:${p.text};overflow:hidden}
.wrap{position:absolute;inset:0;padding:110px 140px;display:flex;flex-direction:column;justify-content:center}
.logo{font-weight:800;letter-spacing:-2px;color:#fff}.logo sup{font-size:.35em;color:${p.light};margin-left:4px}
.k{font-size:24px;letter-spacing:.2em;text-transform:uppercase;color:${p.light};font-weight:700}
h1{font-size:92px;line-height:1.05;margin:18px 0 0;font-weight:800;letter-spacing:-2px}
h2{font-size:64px;line-height:1.1;margin:14px 0 0;font-weight:800;letter-spacing:-1px}
p{font-size:34px;line-height:1.5;color:${p.muted};max-width:1400px}
.bar{width:140px;height:8px;background:${p.primary};border-radius:4px;margin:34px 0}
.in{opacity:0;transform:translateY(24px);animation:in .8s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes in{to{opacity:1;transform:none}}
.d1{animation-delay:.25s}.d2{animation-delay:.6s}.d3{animation-delay:1s}.d4{animation-delay:1.4s}.d5{animation-delay:1.8s}.d6{animation-delay:2.2s}.d7{animation-delay:2.6s}.d8{animation-delay:3s}
ul{list-style:none;padding:0;margin:10px 0 0}li{font-size:36px;line-height:1.4;margin:18px 0;display:flex;gap:22px;align-items:flex-start}
li b{color:#fff}li .dot{flex:0 0 18px;height:18px;margin-top:14px;border-radius:50%;background:${p.accent};box-shadow:0 0 0 6px ${p.accent}33}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:70px}
.foot{position:absolute;left:140px;bottom:60px;font-size:22px;color:${p.light};opacity:.8}
.flow{animation:dash 1.2s linear infinite}@keyframes dash{to{stroke-dashoffset:-36}}
${JSON_CSS}`;
}

function makeKit(page, start, brand) {
  const p = palette(brand);
  const doc = (body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${slideCss(p)}${css}</style></head><body>${body}</body></html>`;
  const logoHtml = (size) => {
    if (!p.logo) return '';
    const m = /^(.*?)(™|®)?$/.exec(p.logo);
    return `<div class="logo in" style="font-size:${size}px">${esc(m[1])}${m[2] ? `<sup>${m[2]}</sup>` : ''}</div>`;
  };

  const k = {
    page, sleep, esc, highlightJson, palette: p, W, H,
    /** Begin capturing frames. Call once the first screen is ready (slide() does it for you). */
    start,

    // ---------- real pages ----------
    /** Navigate, strip common popups, add the URL bar overlay (urlBar:false to skip). */
    async open(url, { urlBar = true, waitUntil = 'networkidle', removeSelectors = [] } = {}) {
      await page.goto(url, { waitUntil, timeout: 60000 }).catch(() => {});
      await page.evaluate((sels) => {
        const junk = ['.message.global.cookie', '.modals-overlay', '.modal-popup._show', '#onetrust-banner-sdk', '.cookie-banner', ...sels];
        junk.forEach((s) => document.querySelectorAll(s).forEach((e) => e.remove()));
      }, removeSelectors).catch(() => {});
      await k.overlay(urlBar ? url : null);
    },
    /** (Re)inject overlay styles, and the URL bar if a url is given. Needed after page.setContent(). */
    async overlay(url) {
      await page.evaluate(({ css, url }) => {
        if (!document.getElementById('dv-style')) {
          const s = document.createElement('style'); s.id = 'dv-style'; s.textContent = css; document.head.appendChild(s);
        }
        if (url && !document.getElementById('dv-url')) {
          const u = document.createElement('div'); u.id = 'dv-url'; u.innerHTML = '<i></i>'; u.append(url);
          document.body.appendChild(u); document.body.style.marginTop = '52px';
        }
      }, { css: overlayCss(p), url });
    },
    /** Lower-third caption: kicker (small caps), title, optional body. HTML allowed. */
    async caption(kicker, title, body = '') {
      await k.overlay();
      await page.evaluate(({ kicker, title, body }) => {
        let c = document.getElementById('dv-cap');
        if (!c) { c = document.createElement('div'); c.id = 'dv-cap'; document.body.appendChild(c); }
        c.classList.remove('on');
        c.innerHTML = `<div class="k">${kicker}</div><div class="t">${title}</div>${body ? `<div class="b">${body}</div>` : ''}`;
        requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('on')));
      }, { kicker, title, body });
    },
    async hideCaption() { await page.evaluate(() => document.getElementById('dv-cap')?.classList.remove('on')); },
    /** Outline an element (scrolls it into view). Pass on=false to clear. */
    async highlight(selector, on = true) {
      await k.overlay();
      await page.evaluate(({ selector, on }) => {
        const el = document.querySelector(selector);
        if (!el) return;
        if (on) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('dv-hl'); } else el.classList.remove('dv-hl');
      }, { selector, on });
    },
    /** Smoothly scroll the window by px over ms. */
    async scroll(px, ms = 3000) {
      const steps = Math.max(1, Math.round(ms / 33));
      for (let i = 0; i < steps; i++) { await page.evaluate((d) => window.scrollBy(0, d), px / steps); await sleep(33); }
    },
    /** Smoothly scroll an element (code panes, drawers). */
    async scrollEl(selector, px, ms = 3000) {
      const steps = Math.max(1, Math.round(ms / 33));
      for (let i = 0; i < steps; i++) {
        await page.evaluate(({ s, d }) => { const e = document.querySelector(s); if (e) e.scrollTop += d; }, { s: selector, d: px / steps });
        await sleep(33);
      }
    },
    /** Slide-in right-hand panel showing JSON (object) or text (string). */
    async drawer(title, content) {
      await k.overlay();
      const html = typeof content === 'string' ? esc(content) : highlightJson(content);
      await page.evaluate(({ title, html }) => {
        let d = document.getElementById('dv-drawer');
        if (!d) { d = document.createElement('div'); d.id = 'dv-drawer'; document.body.appendChild(d); }
        d.innerHTML = `<h3>${title}</h3><pre>${html}</pre>`;
        requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('on')));
      }, { title, html });
    },
    async closeDrawer() { await page.evaluate(() => document.getElementById('dv-drawer')?.classList.remove('on')); },
    /** Visible cursor glides to an element, "clicks" it (real click unless click:false). */
    async click(selector, { click = true } = {}) {
      await k.overlay();
      // Skip (don't hang) when the element is missing or not visible.
      const loc = page.locator(selector).first();
      const box = await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).then(() => loc.boundingBox({ timeout: 3000 })).catch(() => null);
      if (!box) return;
      await page.evaluate(({ x, y }) => {
        let c = document.getElementById('dv-cursor');
        if (!c) { c = document.createElement('div'); c.id = 'dv-cursor'; c.style.left = (innerWidth / 2) + 'px'; c.style.top = (innerHeight / 2) + 'px'; document.body.appendChild(c); }
        requestAnimationFrame(() => { c.style.left = x + 'px'; c.style.top = y + 'px'; });
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      await sleep(750);
      await page.evaluate(() => document.getElementById('dv-cursor')?.classList.add('click'));
      await sleep(150);
      await page.evaluate(() => document.getElementById('dv-cursor')?.classList.remove('click'));
      if (click) await page.locator(selector).first().click().catch(() => {});
    },
    /** Human-speed typing into a field. */
    async type(selector, text, delay = 55) {
      await k.click(selector);
      await page.locator(selector).first().pressSequentially(text, { delay });
    },

    // ---------- generated screens ----------
    /** Show a full-screen HTML document for `seconds`. Starts recording on a blank frame so entrance animations are captured. */
    async slide(html, seconds) {
      await page.setContent(`<body style="margin:0;background:${p.bgDeep}"></body>`);
      await start();
      await page.setContent(html);
      await sleep(seconds * 1000);
    },
    /** Wrap raw body HTML + extra CSS in the branded slide document. */
    doc,
    titleSlide({ title, subtitle = '', footer = '', logo = true }) {
      return doc(`<div class="wrap">${logo && p.logo ? logoHtml(150) : `<h1 class="in">${title}</h1>`}
        <div class="bar in d1"></div>
        ${logo && p.logo ? `<h2 class="in d2" style="font-weight:600;color:${p.text}">${title}</h2>` : ''}
        ${subtitle ? `<p class="in d3" style="margin-top:30px">${subtitle}</p>` : ''}</div>
        ${footer ? `<div class="foot in d4">${footer}</div>` : ''}`);
    },
    sectionSlide({ kicker, title, body = '' }) {
      return doc(`<div class="wrap"><div class="k in">${kicker}</div><h1 class="in d1">${title}</h1>
        <div class="bar in d2"></div>${body ? `<p class="in d3">${body}</p>` : ''}</div>`);
    },
    /** bullets: array of HTML strings (use <b> for emphasis). */
    bulletSlide({ kicker = '', title, bullets = [], footer = '' }) {
      return doc(`<div class="wrap">${kicker ? `<div class="k in">${kicker}</div>` : ''}<h2 class="in d1">${title}</h2>
        <ul>${bullets.map((b, i) => `<li class="in d${Math.min(i + 2, 8)}"><span class="dot"></span><span>${b}</span></li>`).join('')}</ul>
        ${footer ? `<p class="in d${Math.min(bullets.length + 2, 8)}" style="margin-top:40px">${footer}</p>` : ''}</div>`);
    },
    /** columns: [{ title, bullets: [html] }, …] (2 recommended). */
    columnsSlide({ kicker = '', columns = [] }) {
      return doc(`<div class="wrap" style="padding:90px 140px">${kicker ? `<div class="k in">${kicker}</div>` : ''}
        <div class="grid2" style="margin-top:30px">${columns.map((c) => `<div><h2 class="in d1" style="font-size:46px">${c.title}</h2>
          <ul style="margin-top:14px">${c.bullets.map((b, i) => `<li class="in d${Math.min(i + 2, 8)}" style="font-size:28px"><span class="dot"></span><span>${b}</span></li>`).join('')}</ul></div>`).join('')}
        </div></div>`);
    },
    endSlide({ line = '' }) {
      return doc(`<div class="wrap" style="align-items:center;text-align:center">${p.logo ? logoHtml(170) : ''}
        <div class="bar in d1"></div>${line ? `<p class="in d2" style="font-size:38px">${line}</p>` : ''}</div>`);
    },
    /** Full-screen HTTP response viewer: GET/POST bar + highlighted JSON (or text). Scroll it with k.scrollEl('#code', …). */
    jsonView(method, url, content) {
      const body = typeof content === 'string' ? esc(content) : highlightJson(content);
      return doc(`<div style="position:absolute;inset:0;display:flex;flex-direction:column">
        <div style="height:84px;display:flex;align-items:center;gap:18px;padding:0 48px;background:${p.primary};font:600 26px ui-monospace,Menlo,monospace">
        <span style="background:${p.text};color:${p.primary};padding:6px 14px;border-radius:8px;font-weight:800">${esc(method)}</span>${esc(url)}</div>
        <pre id="code" style="margin:0;flex:1;overflow:hidden;padding:36px 48px 260px;font:24px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word">${body}</pre></div>`);
    },
    /** Terminal window. Use with k.typeAndRun(cmd) to type the command then reveal `output` (object → JSON, string → text). */
    terminal(cmd, output, title = 'terminal') {
      const out = typeof output === 'string' ? esc(output) : highlightJson(output);
      return doc(`<div style="position:absolute;inset:60px 80px 60px;background:${p.bgDeep};border-radius:18px;border:2px solid ${p.bgGlow};box-shadow:0 30px 80px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden">
        <div style="height:52px;background:${p.bg};display:flex;align-items:center;gap:10px;padding:0 20px"><i style="width:14px;height:14px;border-radius:50%;background:#ef4444"></i><i style="width:14px;height:14px;border-radius:50%;background:#f59e0b"></i><i style="width:14px;height:14px;border-radius:50%;background:#10b981"></i><span style="margin-left:18px;color:${p.light};font:600 20px ui-monospace,Menlo,monospace">${esc(title)}</span></div>
        <pre id="code" style="margin:0;flex:1;overflow:hidden;padding:28px 36px 240px;font:23px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;color:${p.text}"><span style="color:${p.accent}">$ </span><span id="cmd" data-cmd="${esc(cmd)}"></span><span id="caret" style="background:${p.accent}">&nbsp;</span>\n<span id="out" style="display:none">${out}</span></pre></div>`);
    },
    async typeAndRun(charDelay = 22) {
      const cmd = await page.evaluate(() => document.getElementById('cmd').dataset.cmd);
      for (const ch of cmd) {
        await page.evaluate((c) => { document.getElementById('cmd').textContent += c; }, ch);
        await sleep(ch === '\n' ? 200 : charDelay);
      }
      await sleep(600);
      await page.evaluate(() => { document.getElementById('caret')?.remove(); document.getElementById('out').style.display = 'inline'; });
    },
    /** Replace the current screen with generated HTML without restarting the recording. */
    async show(html) { await page.setContent(html); await k.overlay(); },
  };
  return k;
}

module.exports = { makeKit, palette, highlightJson, W, H };
