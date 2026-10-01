// Placement test: 6 quick questions per level; stops at the first level that is not passed.
import { api, h } from '../ui.js';
import { renderExercise } from '../exercise.js';
import { go, refreshBoot } from '../app.js';

const NAMES = { a1: 'Survival (A1)', a2: 'Everyday (A2)', b1: 'Conversational (B1)', b2: 'Fluent-ish (B2)' };

export default async function (main) {
  const data = await api('placement');
  let cleanup = null;
  const skip = () => { sessionStorage.setItem('skipPlacement', '1'); go('#/home'); };

  main.append(h('div.card.center',
    h('h1', 'Where should you start?'),
    h('p', { style: 'max-width:60ch;margin:8px auto' }, data.intro || ''),
    h('div.row', { style: 'justify-content:center;margin-top:12px' },
      h('button.btn.primary.big', { onclick: start }, 'Start the placement test'),
      h('button.btn', { onclick: () => finish('a1', {}) }, 'I’m a beginner — start from zero'),
      h('button.btn.ghost', { onclick: skip }, 'Not now'))));

  function start() {
    const detail = {};
    let b = 0; let q = 0; let right = 0;
    const stage = h('div');
    const label = h('div.small.muted');
    main.replaceChildren(h('div.topbar', h('b', 'Placement test'), label,
      h('button.btn.ghost', { onclick: () => { if (cleanup) cleanup(); go('#/home'); } }, '✕')), stage);
    const next = () => {
      if (cleanup) cleanup();
      const block = data.blocks[b];
      if (!block || !block.questions.length) return finishAt(b);
      if (q >= block.questions.length) {
        detail[block.level] = { right, total: block.questions.length };
        const passed = right / block.questions.length >= data.pass_mark;
        if (!passed) return finishAt(b);
        b += 1; q = 0; right = 0;
        return next();
      }
      label.textContent = `${NAMES[block.level]} · question ${q + 1} of ${block.questions.length}`;
      cleanup = renderExercise(stage, block.questions[q], { dry: true, ctx: { placement: true }, onDone: (r) => {
        if (r && r.correct) right += 1;
        q += 1; next();
      } });
    };
    const finishAt = (blockIndex) => {
      const lvl = data.blocks[Math.min(blockIndex, data.blocks.length - 1)].level;
      finish(lvl, detail);
    };
    next();
  }

  async function finish(level, detail) {
    if (cleanup) cleanup();
    const out = await api('placement/finish', { level, detail });
    await refreshBoot();
    const rows = Object.entries(detail).map(([lv, d]) => h('li', `${NAMES[lv]}: ${d.right} / ${d.total}`));
    main.replaceChildren(h('div.card.center',
      h('h1', `You start at: ${NAMES[level]}`),
      rows.length ? h('ul', { style: 'display:inline-block;text-align:left' }, rows) : null,
      h('p.muted', 'Every unit stays open, so you can always go back to fill a gap — or jump ahead.'),
      out.next_unit ? h('a.unit', { href: '#/unit/' + encodeURIComponent(out.next_unit.id), style: 'max-width:520px;margin:12px auto;text-align:left' },
        h('div.num', '→'), h('div', h('div.t', out.next_unit.title), h('div.g', out.next_unit.goal || ''))) : null,
      h('button.btn.primary', { onclick: () => go('#/home') }, 'Go to Today')));
  }
  return () => { if (cleanup) cleanup(); };
}
