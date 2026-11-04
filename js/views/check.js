// A stage check: 12 questions on the stage's basics (its table, its irregular verbs). 80% → on to the extras;
// otherwise the path keeps it as the next chapter, with the basics chapters and a workout to look at first.
import { api, h, chapterHref, prefetchAudio, audioOf, afterChapter, KIND_ICON } from '../ui.js';
import { runSequence } from '../exercise.js';

export default async function (main, [cid]) {
  let stop = null;
  let d = await api('course/tensecheck/' + encodeURIComponent(cid));

  const basicsList = () => h('div', d.basics.map((ch) => h('a.unit' + (ch.completed || ch.skipped ? '.done' : ''),
    { href: chapterHref(ch) }, h('div.num', ch.completed ? '✓' : ch.skipped ? '↷' : String(ch.pos)),
    h('div', h('div.t', `${KIND_ICON[ch.kind] || ''} ${ch.title}`), h('div.g', ch.goal || '')))));

  const show = () => {
    if (stop) { stop(); stop = null; }
    const st = d.status || {};
    main.replaceChildren(h('div.lesson',
      h('a.small', { href: '#/learn' }, '← Learn'),
      h('div.small.muted', { style: 'margin-top:6px' }, `Stage ${d.stage_n} · chapter ${d.pos} of ${d.count} · ✅ Check`),
      h('h1', d.title),
      h('div.intro', h('div.label', '📖 Before you start'),
        h('div', `This check makes sure the basics of this stage are solid before the extra chapters: ${d.items.length} `
          + `questions taken from the chapters below. Get ${d.pass_pct}% right and you move on. If you don’t, nothing is `
          + 'lost — your mistakes go to the Notebook, and you can look at the chapters again and retry whenever you like.')),
      st.completed ? h('p.small', `✓ Passed (best ${Math.round(100 * (st.best || 0))}%).`)
        : st.attempts ? h('p.small.muted', `Best so far: ${Math.round(100 * (st.best || 0))}%.`) : null,
      h('div.card.center', h('button.btn.primary.big', { type: 'button', onclick: run }, 'Start the check →')),
      h('h3', 'The basics it covers'), basicsList()));
    window.scrollTo(0, 0);
  };

  const run = () => {
    const stage = h('div');
    main.replaceChildren(stage);
    prefetchAudio(audioOf(d.items));
    stop = runSequence(stage, d.items, { title: d.title, retry: false, ctx: { check: d.id }, onFinish: async (res) => {
      stop = null;
      if (res.aborted) { show(); return; }
      const out = await api('course/checkdone', { id: d.id, right: res.right, total: res.total });
      const pct = res.total ? Math.round(100 * res.right / res.total) : 0;
      if (out.passed) {
        main.replaceChildren(h('div.card.center', h('h1', '¡Muy bien!'),
          h('p', `${res.right} / ${res.total} (${pct}%) — the basics are solid. On to the extra chapters.`),
          h('div.row', { style: 'justify-content:center' }, ...afterChapter(d.id, out.next))));
        return;
      }
      d = await api('course/tensecheck/' + encodeURIComponent(cid));        // fresh questions for the next try
      main.replaceChildren(h('div', h('div.card.center', h('h1', 'Not yet'),
        h('p', `${res.right} / ${res.total} (${pct}%). You need ${d.pass_pct}%.`),
        h('p.muted', 'Your mistakes are in the Notebook. Have another look at the basics (or do a short workout), then '
          + 'try again — the check comes with new questions each time.'),
        h('div.row', { style: 'justify-content:center' },
          d.tense ? h('a.btn.primary', { href: '#/practice/tense/' + d.tense }, 'Workout for this tense') : null,
          h('button.btn', { onclick: run }, 'Try again now'),
          ...afterChapter(d.id, null))),
      h('h3', 'The basics'), basicsList()));
    } });
  };

  show();
  return () => { if (stop) stop(); };
}
