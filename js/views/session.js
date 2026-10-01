// Today's session: mistakes to fix + due reviews + a few new words + weighted drills.
import { api, h } from '../ui.js';
import { runSequence } from '../exercise.js';
import { go, refreshBoot } from '../app.js';

export default async function (main) {
  main.append(h('p.muted', 'Building today’s session…'));
  const s = await api('session/today', {});
  let stop = null;
  if (!s.items.length) {
    main.replaceChildren(h('div.card.center', h('h2', 'Nothing to practise yet'),
      h('p.muted', 'Start with a unit and the reviews will build up from there.'),
      h('button.btn.primary', { onclick: () => go('#/learn') }, 'Go to the units')));
    return null;
  }
  const sm = s.summary;
  const startedAt = Date.now();
  const begin = () => {
    const stage = h('div');
    main.replaceChildren(stage);
    stop = runSequence(stage, s.items, { title: 'Today', ctx: { session: 'today' }, onFinish: async (res) => {
      const out = await api('session/finish', {});
      await refreshBoot();
      const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      main.replaceChildren(h('div.card.center',
        h('h1', res.aborted ? 'Session paused' : '¡Listo por hoy!'),
        h('p', `${res.right} of ${res.total} right on the first try · about ${mins} min · 🔥 ${out.streak}-day streak`),
        s.next_unit ? h('div', { style: 'max-width:520px;margin:14px auto;text-align:left' }, h('div.small.muted', 'Next lesson'),
          h('a.unit', { href: '#/unit/' + encodeURIComponent(s.next_unit.id) }, h('div.num', '→'),
            h('div', h('div.t', s.next_unit.title), h('div.g', s.next_unit.goal || '')))) : null,
        h('div.row', { style: 'justify-content:center' },
          h('button.btn', { onclick: () => go('#/home') }, 'Home'),
          h('button.btn', { onclick: () => go('#/notebook') }, 'Mistake Notebook'),
          h('button.btn.primary', { onclick: () => { location.hash = '#/practice'; } }, 'More practice'))));
    } });
  };
  main.replaceChildren(h('div.card.center',
    h('h1', 'Today’s session'),
    h('p.muted', `About ${s.minutes} minutes · ${s.items.filter((x) => x.type !== 'intro').length} questions`),
    h('div.grid', { style: 'max-width:640px;margin:12px auto' },
      h('div.stat', h('div.n', String(sm.mistakes)), h('div.l', 'mistakes to fix')),
      h('div.stat', h('div.n', String(sm.reviews)), h('div.l', 'reviews due')),
      h('div.stat', h('div.n', String(sm.new_words)), h('div.l', 'new words')),
      h('div.stat', h('div.n', String(sm.drills)), h('div.l', 'drills'))),
    h('button.btn.primary.big', { onclick: begin, autofocus: true }, 'Start'),
    h('p.small.muted.kbd-hint', { style: 'margin-top:10px' }, 'Enter submits · Enter again continues · number keys pick answers')));
  const onKey = (e) => { if (e.key === 'Enter' && !stop) { e.preventDefault(); document.removeEventListener('keydown', onKey); begin(); } };
  document.addEventListener('keydown', onKey);
  return () => { document.removeEventListener('keydown', onKey); if (stop) stop(); };
}
