// Minimal template showing every kind of scene. Render it with:
//   node ~/.claude/skills/demo-video/render.js ~/.claude/skills/demo-video/example.scenes.js --audio --path examples
module.exports = {
  slug: 'demo-video-example',
  name: 'example',
  brand: { primary: '#047857', logo: 'Acme™' },

  scenes: [
    {
      name: 'title',
      narration: 'Acme. A thirty second tour of what this skill can record.',
      run: (k) => k.slide(k.titleSlide({ title: 'Demo video skill', subtitle: 'Slides, real pages, APIs and terminals', footer: 'Example' }), 5),
    },
    {
      name: 'bullets',
      narration: 'Slides animate in point by point, in your brand colours.',
      run: (k) => k.slide(k.bulletSlide({ kicker: 'Slides', title: 'Branded, animated', bullets: ['Title, section, bullet and column layouts', 'Custom HTML or SVG with <b>k.doc()</b>', 'Brand colour and wordmark from the scenes file'] }), 6),
    },
    {
      name: 'web-page',
      narration: 'Real pages are recorded live, with captions, highlights and a visible cursor. A side panel shows what a machine reads from the same page.',
      run: async (k) => {
        const url = 'https://en.wikipedia.org/wiki/Demoscene';
        await k.open(url, { removeSelectors: ['#siteNotice', '.cdx-dialog-backdrop', '.frb-overlay'] });
        const ld = await k.page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || '{}'));
        await k.start();
        await k.caption('Real page', 'Recorded live', 'Captions, highlights and a cursor are overlaid on the real site.');
        await k.sleep(1500);
        await k.highlight('#firstHeading'); await k.sleep(1500); await k.highlight('#firstHeading', false);
        await k.click('.mw-parser-output > p a[href^="/wiki/"]', { click: false }); await k.sleep(1200);
        await k.scroll(500, 2000);
        await k.drawer('application/ld+json', ld);
        await k.caption('Structured data', 'What a machine sees', 'The same page, as JSON-LD, in a slide-in panel.');
        await k.sleep(3500);
      },
    },
    {
      name: 'api',
      narration: 'API calls can be shown as a terminal, typed out, with the real response.',
      run: async (k) => {
        const res = await (await fetch('https://httpbin.org/json')).json().catch(() => ({ note: 'offline' }));
        await k.page.setContent(k.terminal('curl https://httpbin.org/json', res, 'demo — terminal'));
        await k.start();
        await k.typeAndRun();
        await k.scrollEl('#code', 400, 2500);
        await k.sleep(1500);
      },
    },
    {
      name: 'end',
      narration: 'That is the whole kit.',
      run: (k) => k.slide(k.endSlide({ line: 'Made with the demo-video skill.' }), 4),
    },
  ],
};
