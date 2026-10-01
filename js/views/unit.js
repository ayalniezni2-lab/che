// A unit: first the teaching section (always), then the exercises.
import { api, h, md, accentMarked, exampleRow, conjTable, playBtn, regTag, esc } from '../ui.js';
import { runSequence } from '../exercise.js';
import { go } from '../app.js';

export function dialogueBlock(d) {
  if (!d) return null;
  return h('div.card.flat.dialogue',
    h('div.row.between', h('b', d.title || 'Dialogue'), d.setting ? h('span.small.muted', d.setting) : null),
    d.lines.map((l) => h('div.line',
      h('div.who', l.name || ''), playBtn(l.audio, { slow: true }),
      h('div', h('div.es', { html: accentMarked(l.es) }), h('div.en.small', l.en || '')))),
    (d.notes || []).length ? h('div.tip.small', { html: md(d.notes.map((n) => '- ' + n).join('\n')) }) : null);
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

export default async function (main, [uid, mode]) {
  const u = await api('unit/' + encodeURIComponent(uid));
  let stop = null;

  const showLesson = () => {
    if (stop) { stop(); stop = null; }
    main.replaceChildren(h('div.lesson',
      h('div.row.between', h('a.small', { href: '#/learn' }, '← All units'),
        h('span.tag.level', (u.level || '').toUpperCase())),
      h('h1', u.title), u.goal ? h('p.muted', u.goal) : null,
      (u.teach || []).map(teachBlock),
      h('div.card.center',
        h('p', `${u.exercises.length} exercises. Wrong answers come back once at the end.`),
        h('button.btn.primary.big', { type: 'button', onclick: showExercises }, 'Start the exercises →'))));
    window.scrollTo(0, 0);
  };

  const showExercises = () => {
    const stage = h('div');
    main.replaceChildren(stage);
    stop = runSequence(stage, u.exercises, { title: u.title, ctx: { unit: u.id }, onFinish: async (res) => {
      if (res.aborted) { showLesson(); return; }
      const score = res.total ? res.right / res.total : 1;
      const out = await api('unit/complete', { unit: u.id, score });
      main.replaceChildren(h('div.card.center',
        h('h1', out.passed ? '¡Bien ahí!' : 'Good effort'),
        h('p', `First-try score: ${res.right} / ${res.total} (${Math.round(score * 100)}%).`),
        h('p.muted', out.passed ? 'Unit complete. Everything you practised is now in your review schedule.'
          : 'You need 70% to tick the unit off. The mistakes are in your Notebook — read the lesson again and retry.'),
        h('div.row', { style: 'justify-content:center' },
          h('button.btn', { onclick: showLesson }, 'Back to the lesson'),
          h('button.btn', { onclick: showExercises }, 'Try again'),
          u.next ? h('button.btn.primary', { onclick: () => go('#/unit/' + encodeURIComponent(u.next)) }, 'Next unit →') : null)));
    } });
  };

  if (mode === 'practice') showExercises(); else showLesson();
  return () => { if (stop) stop(); };
}
