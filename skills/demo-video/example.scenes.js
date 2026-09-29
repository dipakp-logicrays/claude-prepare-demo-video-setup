// Template showing every kind of scene, written as beats: each beat is one spoken sentence plus the
// one visual step it describes. The recording waits for each sentence, so picture and voice stay in sync.
// Render it with:
//   node ~/.claude/skills/demo-video/render.js ~/.claude/skills/demo-video/example.scenes.js --audio --path examples
module.exports = {
  slug: 'demo-video-example',
  name: 'example',
  brand: { primary: '#047857', logo: 'Acme™' },
  pronounce: { 'JSON-LD': 'J SON L D' },

  scenes: [
    {
      name: 'title',
      setup: (k) => k.present(k.titleSlide({ title: 'Demo video skill', subtitle: 'Slides, real pages, and live data', footer: 'Example' })),
      beats: [{ say: 'Welcome. This is a short tour of what the demo video skill can record.' }],
    },
    {
      name: 'reveal',
      setup: (k) => k.present(k.bulletSlide({
        kicker: 'Slides', title: 'One point at a time', steps: true,
        bullets: ['Each point appears <b>as it is spoken</b>', 'Like clicking <b>next</b> in a presentation', 'Your <b>brand colour</b> throughout'],
      })),
      beats: [
        { say: 'Slides reveal one point at a time.' },
        { say: 'Each point appears exactly when the voice reaches it,', do: (k) => k.next() },
        { say: 'just like clicking next in a presentation.', do: (k) => k.next() },
        { say: 'And everything uses your brand colour.', do: (k) => k.next() },
      ],
    },
    {
      name: 'web-page',
      setup: async (k) => {
        await k.open('https://en.wikipedia.org/wiki/Demoscene', { removeSelectors: ['#siteNotice', '.cdx-dialog-backdrop', '.frb-overlay'] });
        const ld = await k.page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || '{}'));
        k.state = { '@type': ld['@type'], name: ld.name, headline: ld.headline, datePublished: ld.datePublished, publisher: ld.publisher?.name };
      },
      beats: [
        { say: 'Real web pages are recorded live.', do: (k) => k.caption('Real page', 'Recorded live', 'Captions, highlights and a cursor on the real site.') },
        { say: 'The part being talked about is highlighted,', do: (k) => k.highlight('#firstHeading') },
        { say: 'and a cursor can point at anything on the page.', do: async (k) => { await k.highlight('#firstHeading', false); await k.click('.mw-parser-output > p a[href^="/wiki/"]', { click: false }); } },
        {
          say: 'A side panel can show what a computer reads from the same page.',
          do: async (k) => { await k.drawer('What a computer reads (JSON-LD)', k.state); await k.caption('Behind the page', 'What a computer reads', 'Structured data, next to the real page.'); },
        },
        { say: 'And the lines being discussed light up: here, the title and the publisher.', do: (k) => k.mark(['"name"', '"publisher"']) },
      ],
    },
    {
      name: 'explain',
      setup: async (k) => {
        const res = await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m')).json().catch(() => ({ note: 'offline' }));
        await k.present(k.explainSlide({
          kicker: 'Live data', title: 'Explain it simply, show it on the side',
          points: [{ title: 'Where', text: 'Berlin' }, { title: 'How warm it is', text: 'The current temperature' }],
          json: res, jsonTitle: 'api.open-meteo.com/v1/forecast',
        }));
      },
      beats: [
        { say: 'Technical data is explained in plain words, with the real response shown on the side.' },
        { say: 'This request asks for the weather in Berlin,', do: async (k) => { await k.next(); await k.mark(['"latitude"', '"longitude"']); } },
        { say: 'and this line is the answer: the temperature right now.', do: async (k) => { await k.next(); await k.mark(['"temperature_2m":', '"temperature_2m":']); } },   // the unit line and the value line
      ],
    },
    {
      name: 'end',
      setup: (k) => k.present(k.endSlide({ line: 'Made with the demo-video skill.' })),
      beats: [{ say: "That's the whole kit. Thanks for watching." }],
    },
  ],
};
