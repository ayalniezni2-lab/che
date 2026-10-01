// Today: streak, quick stats, the "Today" session button.
import { h } from '../ui.js';
import { refreshBoot, go } from '../app.js';

export default async function (main) {
  const b = await refreshBoot();
  const t = b.today || {};
  const acc = t.answers ? Math.round(100 * t.correct / t.answers) : null;
  const done = b.units.filter((u) => u.completed).length;
  main.append(h('div',
    h('h1', '¡Hola, che!'),
    h('p.muted', 'Argentine Spanish, the way it is spoken in Buenos Aires. Vos, never tú.'),
    h('div.card.center',
      h('p', b.due ? `${b.due} reviews are waiting for you.`
        : 'About 15 minutes: reviews that are due, something new, and your recent mistakes.'),
      h('button.btn.primary.big', { onclick: () => go('#/session/today'), autofocus: true }, '▶  Today’s session'),
      h('p.small.muted.kbd-hint', { style: 'margin-top:10px' },
        'Tip: Enter submits, Enter again continues, number keys pick answers.')),
    h('div.grid',
      h('div.card.stat', h('div.n', '🔥 ' + (b.streak || 0)), h('div.l', 'day streak')),
      h('div.card.stat', h('div.n', String(t.answers || 0)),
        h('div.l', 'answers today' + (acc === null ? '' : ` · ${acc}% right`))),
      h('div.card.stat', h('div.n', `${done}/${b.units.length}`), h('div.l', 'units finished')),
      h('div.card.stat', h('div.n', String(b.counts.vocab)), h('div.l', 'words & phrases in the app'))),
    h('div.card',
      h('h3', 'Keep going'),
      nextUnit(b),
      h('div.row', { style: 'margin-top:10px' },
        h('button.btn', { onclick: () => go('#/learn') }, 'All units'),
        h('button.btn', { onclick: () => go('#/practice') }, 'Free practice'),
        h('button.btn', { onclick: () => go('#/notebook') }, 'Mistake Notebook'))),
    b.content_errors && b.content_errors.length
      ? h('div.card', h('h3', 'Content problems'), h('ul', b.content_errors.map((e) => h('li.small', e)))) : null,
  ));
}

function nextUnit(b) {
  const lvl = (b.placement && b.placement.level) || 'a1';
  const order = ['a1', 'a2', 'b1', 'b2'];
  const from = order.indexOf(lvl);
  const next = b.units.find((u) => !u.completed && order.indexOf(u.level) >= from)
    || b.units.find((u) => !u.completed);
  if (!next) {
    return h('p.muted', b.units.length
      ? 'You finished every unit. Type "refill" in Claude Code for more.' : 'No units yet.');
  }
  return h('a.unit', { href: '#/unit/' + encodeURIComponent(next.id) },
    h('div.num', String(next.order || '•')),
    h('div', h('div.t', next.title), h('div.g', next.goal || '')));
}
