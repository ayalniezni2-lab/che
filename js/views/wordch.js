// A word chapter: 10 new words from one word list — read and hear them, then answer questions on them.
// "I know these" = 6 of them typed in Spanish (80% ticks the chapter off).
import { api, h, accentMarked, playBtn, regTag, toast, prefetchAudio, audioOf, afterChapter, chapterHref } from '../ui.js';
import { runSequence, savedPlace, forgetPlace } from '../exercise.js';
import { go } from '../app.js';

export default async function (main, [cid]) {
  if (!cid) return listAll(main);
  const w = await api('wordch/' + encodeURIComponent(cid));
  let stop = null;
  const KEY = 'che-resume:wch:' + w.id;
  const done = !!(w.status && (w.status.completed || w.status.skipped));
  prefetchAudio(w.words.flatMap((x) => [x.audio, x.ex_audio]).filter(Boolean).concat(audioOf(w.exercises)));

  const show = () => {
    if (stop) { stop(); stop = null; }
    const place = savedPlace(KEY);
    const met = w.words.filter((x) => x.met).length;
    main.replaceChildren(h('div.lesson',
      h('a.small', { href: '#/learn' }, '← Learn'),
      h('div.small.muted', { style: 'margin-top:6px' }, `📚 New words · ${(w.level || '').toUpperCase()}`),
      h('h1', w.title),
      h('div.intro', h('div.label', '📖 Before you start'),
        h('div', 'Read each word and its example sentence, and tap ▶ to hear it. Then answer '
          + `${w.exercises.length} questions: first what the words mean, then how to say them in Spanish. `
          + `${w.pass_pct}% ticks the chapter off, and the words come back in your reviews.`
          + (met ? ` You have met ${met} of these before.` : ''))),
      place ? h('div.card.center', h('p', 'You stopped half-way through the questions.'),
        h('div.row', { style: 'justify-content:center' },
          h('button.btn.primary', { type: 'button', onclick: () => runQs(place.queue, place) }, 'Continue where I left off'),
          h('button.btn', { type: 'button', onclick: () => { forgetPlace(KEY); show(); } }, 'Start them again'))) : null,
      h('div.card.flat', w.words.map((it) => h('div.example', playBtn(it.audio), h('div.txt',
        h('div', h('span.es', { html: accentMarked(it.es) }), ' ', regTag(it.reg), h('span.en', '  ' + it.en),
          it.met ? h('span.small.muted', '  · met before') : null),
        it.ex ? h('div.small', it.ex_audio ? playBtn(it.ex_audio, { slow: false }) : null, ' ', h('span.es', { html: accentMarked(it.ex) }),
          h('span.en', ' — ' + (it.ex_en || ''))) : null,
        it.note ? h('div.small.muted', it.note) : null)))),
      h('div.card.center',
        h('button.btn.primary.big', { type: 'button', onclick: () => { forgetPlace(KEY); runQs(w.exercises, null); } },
          'Start the questions →'),
        done ? h('p.small.muted', { style: 'margin-top:10px' }, w.status.completed ? '✓ You finished this chapter.'
          : '↷ You skipped this chapter after the check.')
          : h('div', { style: 'margin-top:12px' },
            h('button.btn', { type: 'button', onclick: knowCheck }, 'I know these'),
            h('div.small.muted', { style: 'margin-top:4px' }, 'Type 6 of them in Spanish: get 5 right and the chapter is ticked off.')))));
    window.scrollTo(0, 0);
  };

  const runQs = (items, resume) => {
    const stage = h('div');
    main.replaceChildren(stage);
    stop = runSequence(stage, items, { title: w.title, ctx: { words: w.id }, resumeKey: KEY, resume, onFinish: async (res) => {
      stop = null;
      if (res.aborted) { show(); return; }
      const out = await api('wordch/done', { id: w.id, right: res.right, total: res.total });
      const pct = res.total ? Math.round(100 * res.right / res.total) : 100;
      main.replaceChildren(h('div.card.center',
        h('h1', out.passed ? '¡Bien ahí!' : 'Good effort'),
        h('p', `First-try score: ${res.right} / ${res.total} (${pct}%).`),
        h('p.muted', out.passed ? 'Chapter complete. These words now come back in your reviews.'
          : `You need ${w.pass_pct}% to tick it off. Read the words again and retry.`),
        h('div.row', { style: 'justify-content:center' },
          h('button.btn', { onclick: show }, 'Back to the words'),
          ...afterChapter(w.id, out.next, { passed: out.passed }))));
    } });
  };

  const knowCheck = async () => {
    const data = await api('wordch/check/' + encodeURIComponent(w.id));
    const stage = h('div');
    main.replaceChildren(h('div.card.flat', h('b', 'Quick check: '), `type ${data.items.length} of the words in Spanish. `
      + `${data.pass}% or more and the chapter is ticked off.`), stage);
    stop = runSequence(stage, data.items, { title: 'Check: ' + w.title, dry: true, retry: false, ctx: { check: w.id }, onFinish: async (res) => {
      stop = null;
      if (res.aborted) { show(); return; }
      const out = await api('course/skip', { id: w.id, right: res.right, total: res.total });
      if (out.passed) {
        main.replaceChildren(h('div.card.center', h('h1', '¡Genial!'),
          h('p', `${res.right} / ${res.total} — you know these. The chapter is ticked off.`),
          h('div.row', { style: 'justify-content:center' }, ...afterChapter(w.id, out.next))));
        return;
      }
      main.replaceChildren(h('div.card.center', h('h1', 'Worth a look'),
        h('p', `${res.right} / ${res.total}. Some of these are new to you — the chapter takes about five minutes.`),
        h('div.row', { style: 'justify-content:center' },
          h('button.btn.primary', { onclick: show }, 'Learn them'),
          h('button.btn', { onclick: async () => {
            const o = await api('course/skip', { id: w.id, force: true });
            toast('Skipped. You can come back to it any time from Learn → New words.');
            go(o.next ? chapterHref(o.next) : '#/learn');
          } }, 'Skip anyway'))));
    } });
  };

  show();
  return () => { if (stop) stop(); };
}

// #/wch — every word chapter, by level
async function listAll(main) {
  const data = await api('wordch');
  const s = data.summary;
  main.append(h('a.small', { href: '#/learn' }, '← Learn'), h('h1', '📚 New words'),
    h('p.muted', 'Every word list of the app, cut into short chapters of 10 words. Your path brings one after every '
      + 'two lessons; you can open any of them here. Chapters whose words you have nearly all met already are passed over.'),
    h('p.small', `${s.done} of ${s.count} done.`));
  for (const lv of data.levels) {
    const done = lv.chapters.filter((c) => c.completed || c.skipped).length;
    main.append(h('details.card', { open: s.next && lv.level === s.next.level },
      h('summary', h('div.row.between', { style: 'width:100%' }, h('h2', { style: 'margin:0' }, lv.level.toUpperCase()),
        h('span.muted.small', `${done}/${lv.chapters.length} done`))),
      lv.chapters.map((c) => h('a.unit' + (c.completed || c.skipped ? '.done' : '') + (s.next && c.id === s.next.id ? '.next' : ''),
        { href: chapterHref(c) },
        h('div.num', c.completed ? '✓' : c.skipped ? '↷' : '📚'),
        h('div', { style: 'flex:1' }, h('div.t', c.title),
          h('div.g', s.next && c.id === s.next.id ? 'Next on your path' : c.known ? `${c.known}% met before` : c.goal))))));
  }
}
