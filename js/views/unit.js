// A unit: first the teaching section (always), then the exercises.
import { api, h, md, accentMarked, exampleRow, conjTable, playBtn, regTag, esc, chapterHref, toast, playAll,
  prefetchAudio, audioOf } from '../ui.js';
import { runSequence, savedPlace, forgetPlace } from '../exercise.js';
import { go } from '../app.js';

// A dialogue or reading: ▶ Play all (line by line), and the English hidden or shown (tap a line to see its English).
// hideText: listen first — only the sound and the speakers, the text comes after the questions.
export function dialogueBlock(d, { hideEnglish = false, hideText = false } = {}) {
  if (!d) return null;
  let stopAll = null;
  const lines = d.lines.map((l) => {
    const en = h('div.en.small' + (hideEnglish ? '.hidden' : ''), l.en || '');
    const row = h('div.line' + (hideEnglish && !hideText ? '.tap' : ''),
      h('div.who', l.name || ''), playBtn(l.audio, { slow: true }),
      hideText ? h('div.muted.small', '…') : h('div', h('div.es', { html: accentMarked(l.es) }), en));
    if (hideEnglish && !hideText) {
      row.addEventListener('click', () => en.classList.toggle('hidden'));
      row.title = 'Tap to see the English';
    }
    row._en = en;
    return row;
  });
  const allBtn = h('button.btn.small', { type: 'button', onclick: () => {
    if (stopAll) { stopAll(); return; }
    allBtn.textContent = '■ Stop';
    stopAll = playAll(d.lines.map((l) => l.audio), (i) => {
      lines.forEach((r, j) => r.classList.toggle('speaking', j === i));
      if (i === -1) { stopAll = null; allBtn.textContent = '▶ Play all'; }
    });
  } }, '▶ Play all');
  const enBtn = hideText ? null : h('button.btn.small.ghost', { type: 'button', onclick: () => {
    const show = lines.some((r) => r._en.classList.contains('hidden'));
    lines.forEach((r) => r._en.classList.toggle('hidden', !show));
    enBtn.textContent = show ? 'Hide English' : 'Show English';
  } }, hideEnglish ? 'Show English' : 'Hide English');
  return h('div.card.flat.dialogue',
    h('div.row.between', h('b', d.title || 'Dialogue'), d.setting ? h('span.small.muted', d.setting) : null),
    h('div.row', { style: 'margin:6px 0' }, allBtn, enBtn,
      hideEnglish && !hideText ? h('span.small.muted', 'Tap a line to see its English.') : null),
    lines,
    !hideText && (d.notes || []).length ? h('div.tip.small', { html: md(d.notes.map((n) => '- ' + n).join('\n')) }) : null);
}

export function teachBlock(b) {
  switch (b.t) {
    case 'text': return h('div.md', { html: md(b.md) });
    case 'tip': return h('div.tip', { html: md('💡 ' + b.md) });
    case 'culture': return h('div.culture', { html: md('🧉 ' + b.md) });
    case 'warning': return h('div.tip', { html: md('⚠️ ' + b.md) });
    case 'examples': return h('div.card.flat', b.title ? h('b', b.title) : null, b.items.map(exampleRow));
    case 'verbtable': return h('div.card.flat', conjTable(b.table));
    case 'dialogue': return dialogueBlock(b.dialogue);
    case 'table': return h('div', b.title ? h('b', b.title) : null,
      h('table.t', b.head ? h('thead', h('tr', b.head.map((c) => h('th', c)))) : null,
        h('tbody', b.rows.map((r) => h('tr', r.map((c) => h('td', { html: md(String(c)).replace(/^<p>|<\/p>$/g, '') })))))),
      b.note ? h('div.small.muted', { html: md(b.note) }) : null);
    case 'vocab': return h('div.card.flat', b.title ? h('b', b.title) : null, b.items.map((it) =>
      h('div.example', playBtn(it.audio), h('div.txt',
        h('div', h('span.es', { html: accentMarked(it.es) }), ' ', regTag(it.reg), h('span.en', '  ' + it.en)),
        it.ex ? h('div.small', h('span.es', { html: accentMarked(it.ex) }), h('span.en', ' — ' + (it.ex_en || ''))) : null,
        it.note ? h('div.small.muted', it.note) : null))));
    case 'pairs': return h('div.card.flat', b.title ? h('b', b.title) : null, h('table.t', h('tbody', b.items.map((p) =>
      h('tr', h('td', playBtn(p.a_audio, { slow: false }), ' ', h('span.es', { html: accentMarked(p.a) }), h('div.small.en', p.a_en)),
        h('td', playBtn(p.b_audio, { slow: false }), ' ', h('span.es', { html: accentMarked(p.b) }), h('div.small.en', p.b_en)))))));
    default: return null;
  }
}

const ICON = { tense: '🔤', irregular: '⚡', topic: '💬', general: '☕', reading: '📖' };

export default async function (main, [uid, mode]) {
  const u = await api('unit/' + encodeURIComponent(uid));
  let stop = null;
  const ch = u.chapter;
  const done = !!(u.status && (u.status.completed || u.status.skipped));
  const nextBtn = (label = 'Next chapter →') => (u.next_chapter
    ? h('button.btn.primary', { onclick: () => go(chapterHref(u.next_chapter)) }, label) : null);

  const KEY = 'che-resume:unit:' + u.id;
  const showLesson = () => {
    if (stop) { stop(); stop = null; }
    const teach = (u.teach || []).map((b, i) => (i === 0 && b.t === 'text')
      ? h('div.intro', h('div.label', '📖 Before you start'), h('div.md', { html: md(b.md) }))   // the plain-English opening
      : teachBlock(b));
    const place = savedPlace(KEY);
    const left = place ? place.queue.filter((x) => x.type !== 'intro').length : 0;
    main.replaceChildren(h('div.lesson',
      h('a.small', { href: '#/learn' }, '← Learn'),
      ch ? h('div.small.muted', { style: 'margin-top:6px' },
        `Stage ${ch.stage_n} · chapter ${ch.pos} of ${ch.count} · ${ICON[ch.kind] || ''} ${ch.kind_label || ''}`) : null,
      h('h1', u.title), u.goal ? h('p.muted', u.goal) : null,
      place ? h('div.card.center', h('p', `You stopped half-way through the exercises: ${left} left.`),
        h('div.row', { style: 'justify-content:center' },
          h('button.btn.primary', { type: 'button', onclick: () => runExercises(place.queue, place) }, 'Continue where I left off'),
          h('button.btn', { type: 'button', onclick: () => { forgetPlace(KEY); showLesson(); } }, 'Start them again'))) : null,
      teach,
      h('div.card.center',
        h('p', `${u.exercises.length} exercises. Wrong answers come back once at the end.`),
        h('button.btn.primary.big', { type: 'button', onclick: () => { forgetPlace(KEY); showExercises(); } }, 'Start the exercises →'),
        done ? h('p.small.muted', { style: 'margin-top:10px' },
          u.status.skipped && !u.status.completed ? '↷ You skipped this chapter after the check.' : '✓ You finished this chapter.')
          : h('div', { style: 'margin-top:12px' },
            h('button.btn', { type: 'button', onclick: showCheck }, 'Skip — I know this'),
            h('div.small.muted', { style: 'margin-top:4px' }, 'A short check of 6 questions: get 5 right and the chapter is ticked off.')),
        done && u.next_chapter ? h('div', { style: 'margin-top:10px' }, nextBtn()) : null)));
    window.scrollTo(0, 0);
  };

  const showExercises = () => runExercises(u.exercises, null);

  // "Try again": what you missed comes back, what you got right is swapped for fresh questions (engine: retry_set)
  const tryAgain = async () => {
    const fresh = await api('unit/' + encodeURIComponent(u.id) + '?retry=1');
    runExercises(fresh.exercises, null);
  };

  const runExercises = (items, resume) => {
    const stage = h('div');
    main.replaceChildren(stage);
    prefetchAudio(audioOf(items));
    stop = runSequence(stage, items, { title: u.title, ctx: { unit: u.id }, resumeKey: KEY, resume, onFinish: async (res) => {
      stop = null;
      if (res.aborted) { showLesson(); return; }
      const score = res.total ? res.right / res.total : 1;
      const out = await api('unit/complete', { unit: u.id, score });
      main.replaceChildren(h('div.card.center',
        h('h1', out.passed ? '¡Bien ahí!' : 'Good effort'),
        h('p', `First-try score: ${res.right} / ${res.total} (${Math.round(score * 100)}%).`),
        h('p.muted', out.passed ? 'Chapter complete. Everything you practised is now in your review schedule.'
          : 'You need 70% to tick the chapter off. The mistakes are in your Notebook — read the lesson again and retry.'),
        h('div.row', { style: 'justify-content:center' },
          h('button.btn', { onclick: showLesson }, 'Back to the lesson'),
          h('button.btn', { onclick: tryAgain, title: 'What you missed, plus fresh questions on the same material' }, 'Try again'),
          nextBtn())));
    } });
  };

  // "Skip — I know this": a few questions from the chapter, graded but not saved as reviews or mistakes
  const showCheck = async () => {
    const data = await api('course/check/' + encodeURIComponent(u.id));
    const stage = h('div');
    main.replaceChildren(h('div.card.flat', h('b', 'Quick check: '), `answer ${data.items.length} questions from this chapter. `
      + `${data.pass}% or more and it is ticked off as known.`), stage);
    stop = runSequence(stage, data.items, { title: 'Check: ' + u.title, dry: true, retry: false, ctx: { check: u.id }, onFinish: async (res) => {
      stop = null;
      if (res.aborted) { showLesson(); return; }
      const out = await api('course/skip', { id: u.id, right: res.right, total: res.total });
      if (out.passed) {
        main.replaceChildren(h('div.card.center', h('h1', '¡Genial!'),
          h('p', `${res.right} / ${res.total} — you know this chapter. It is ticked off, and its words and verbs can now come up in your practice.`),
          h('div.row', { style: 'justify-content:center' },
            h('button.btn', { onclick: () => go('#/learn') }, 'Back to Learn'),
            out.next ? h('button.btn.primary', { onclick: () => go(chapterHref(out.next)) }, 'Next chapter →') : null)));
        return;
      }
      main.replaceChildren(h('div.card.center', h('h1', 'Worth a look'),
        h('p', `${res.right} / ${res.total}. We suggest doing this chapter — it will not take long.`),
        h('div.row', { style: 'justify-content:center' },
          h('button.btn.primary', { onclick: showLesson }, 'Do the chapter'),
          h('button.btn', { onclick: async () => {
            const o = await api('course/skip', { id: u.id, force: true });
            toast('Skipped. You can come back to it any time from Learn.');
            go(o.next ? chapterHref(o.next) : '#/learn');
          } }, 'Skip anyway'))));
    } });
  };

  if (mode === 'practice') showExercises(); else showLesson();
  return () => { if (stop) stop(); };
}
