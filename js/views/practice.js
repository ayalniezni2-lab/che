// Free practice: endless drills built on this computer — costs nothing, never runs out.
import { api, h, toast } from '../ui.js';
import { runSequence } from '../exercise.js';

const TENSES = [
  ['pres', 'present'], ['iraf', 'going-to future'], ['imp', 'commands'], ['pret', 'past (finished)'],
  ['impf', '“used to” past'], ['prog', '“am doing”'], ['ger', '-ndo form'], ['subj', '“wishes” form'],
  ['impneg', '“don’t” commands'], ['fut', 'simple future'], ['cond', '“would”'], ['pp', '“done” form'],
  ['perf', '“have done”'], ['subjp', 'past “wishes” form'], ['plup', '“had done”']];

export default async function (main, args = []) {
  let stop = null;
  const chosen = new Set();
  const level = h('select.sel', h('option', { value: '' }, 'My level'), ['a1', 'a2', 'b1', 'b2'].map((l) => h('option', { value: l }, 'Up to ' + l.toUpperCase())));
  const count = h('select.sel', [10, 15, 20, 30].map((n) => h('option', { value: n, selected: n === 15 }, n + ' questions')));
  const verbsBox = h('input.search', { type: 'text', placeholder: 'Only these verbs (optional): tener, ir, hacer', style: 'min-width:320px' });
  const tenseChips = h('div.chips', TENSES.map(([k, l]) => {
    const b = h('button.chip', { type: 'button', 'aria-pressed': 'false', onclick: () => { chosen.has(k) ? chosen.delete(k) : chosen.add(k); b.classList.toggle('sel', chosen.has(k)); b.setAttribute('aria-pressed', String(chosen.has(k))); } }, l);
    return b;
  }));

  const menu = () => {
    if (stop) { stop(); stop = null; }
    main.replaceChildren(h('div',
      h('h1', 'Practice'),
      h('p.muted', 'Endless drills generated on your computer. They lean toward your weak spots and the most common words.'),
      h('div.row', { style: 'margin:10px 0' }, level, count),
      h('div.grid',
        tile('🔀 Mixed', 'A bit of everything', () => run({ kind: 'mixed' })),
        tile('🗂️ Words', 'English → Spanish and back', () => run({ kind: 'vocab' })),
        tile('🎧 Listening', 'Hear it, choose or type it', () => run({ kind: 'listen' })),
        tile('🧩 Sentences', 'Build and translate full sentences', () => run({ kind: 'sentences' }))),
      paceCard,
      h('div.card', h('h3', '🔤 Verb forms'),
        h('p.small.muted', 'Pick tenses (none = everything you have reached so far).'), tenseChips,
        h('div.row', verbsBox, h('button.btn.primary', { onclick: () => run({ kind: 'conj', tenses: [...chosen],
          verbs: verbsBox.value.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean) }) }, 'Drill verbs')))));
  };
  // one tense at a time: every tense taught so far, how comfortable you are with it, and a workout for it
  const paceCard = h('div.card', h('h3', '📈 Your tenses'), h('p.small.muted', 'Loading…'));
  api('pace').then((pc) => {
    if (!pc.tenses.length) {
      paceCard.replaceChildren(h('h3', '📈 Your tenses'),
        h('p.small.muted', 'Verb tenses appear here as the lessons teach them.'));
      return;
    }
    paceCard.replaceChildren(h('h3', '📈 Your tenses'),
      h('p.small.muted', `A tense is comfortable at ${pc.goal}% right over at least ${pc.min_answers} answers. `
        + 'A workout shows the table of anything new, then the forms one by one, then whole sentences.'),
      ...pc.tenses.map((t) => h('div.pace-row',
        h('span.name', (t.mastered ? '✅ ' : t.focus ? '🎯 ' : '• ') + t.label),
        h('div.bar' + (t.mastered ? '.good' : ''), h('i', { style: `width:${t.answers ? t.accuracy : 0}%` })),
        h('span.small.muted', t.answers ? `${t.accuracy}% · ${t.answers}` : t.placement ? 'placement ✓' : 'not yet'),
        h('button.btn', { onclick: () => run({ kind: 'tense', tense: t.tense }) }, 'Workout'))));
  }).catch(() => paceCard.remove());

  const tile = (title, sub, fn) => h('button.card.btn', { style: 'text-align:left;margin:0', onclick: fn }, h('div', { style: 'font-size:1.15rem' }, title), h('div.small.muted', sub));

  async function run(spec) {
    const body = { ...spec, n: Number(count.value), level: level.value || null };
    const { items } = await api('drill', body);
    if (!items.length) { toast('Nothing to drill for that choice yet.'); return; }
    const stage = h('div');
    main.replaceChildren(stage);
    stop = runSequence(stage, items, { title: 'Practice', ctx: { practice: spec.kind }, onFinish: (res) => {
      main.replaceChildren(h('div.card.center', h('h1', res.aborted ? 'Stopped' : '¡Bien!'),
        h('p', `${res.right} of ${res.total} right on the first try.`),
        h('div.row', { style: 'justify-content:center' },
          h('button.btn.primary', { onclick: () => run(spec), autofocus: true }, 'Another round'),
          h('button.btn', { onclick: menu }, 'Back'))));
    } });
  }
  menu();
  if (args[0] === 'tense' && args[1]) run({ kind: 'tense', tense: args[1] });
  return () => { if (stop) stop(); };
}
