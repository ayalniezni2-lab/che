// Simple stats: streak, words known, verbs mastered, accuracy by topic, weakest areas.
import { api, h } from '../ui.js';

const pct = (x) => (x === null || x === undefined ? '—' : Math.round(x * 100) + '%');

function barRow(label, acc, seen) {
  return h('div', { style: 'margin:8px 0' },
    h('div.row.between', h('span', label), h('span.small.muted', `${pct(acc)} · ${seen} answers`)),
    h('div.bar' + (acc >= 0.8 ? '.good' : ''), h('i', { style: `width:${Math.round((acc || 0) * 100)}%` })));
}

export default async function (main) {
  const s = await api('stats');
  const max = Math.max(1, ...s.days.map((d) => d.answers));
  main.append(h('div',
    h('h1', 'Stats'),
    h('div.grid',
      h('div.card.stat', h('div.n', '🔥 ' + s.streak), h('div.l', 'day streak')),
      h('div.card.stat', h('div.n', String(s.words_known)), h('div.l', `words known (of ${s.words_total})`)),
      h('div.card.stat', h('div.n', String(s.verbs_mastered)), h('div.l', `verbs mastered (${s.verbs_practised} practised)`)),
      h('div.card.stat', h('div.n', pct(s.accuracy)), h('div.l', `accuracy · ${s.answers_total} answers`)),
      h('div.card.stat', h('div.n', String(s.due)), h('div.l', 'reviews due')),
      h('div.card.stat', h('div.n', String(s.mistakes_open)), h('div.l', 'mistakes to fix'))),
    h('div.card', h('h3', 'Last 14 days'),
      h('div', { style: 'display:flex;gap:6px;align-items:flex-end;height:110px' }, s.days.map((d) =>
        h('div', { style: 'flex:1;text-align:center', title: `${d.date}: ${d.answers} answers, ${d.correct} right` },
          h('div', { style: `height:${Math.round(90 * d.answers / max)}px;background:var(--accent);border-radius:5px 5px 0 0;opacity:${d.answers ? 1 : .15};min-height:3px` }),
          h('div.small.muted', d.date.slice(8)))))),
    h('div.card', h('h3', 'Units'), s.levels.map((l) => h('div', { style: 'margin:8px 0' },
      h('div.row.between', h('span', l.name), h('span.small.muted', `${l.done} / ${l.units}`)),
      h('div.bar.good', h('i', { style: `width:${l.units ? 100 * l.done / l.units : 0}%` }))))),
    h('div.card', h('h3', 'Weakest areas'),
      s.weakest.length ? s.weakest.map((t) => barRow(t.topic, t.acc, t.seen)) : h('p.muted.small', 'Not enough answers yet.'),
      s.weak_verbs.length ? h('div', h('h3', 'Verbs that trip you up'), h('div.row', s.weak_verbs.map((v) =>
        h('a.tag.slang', { href: '#/verbs/' + encodeURIComponent(v.inf), style: 'text-decoration:none;text-transform:none;font-size:.9rem' }, `${v.inf} ${pct(v.acc)}`)))) : null),
    h('div.card', h('h3', 'Verb forms, by tense'),
      s.by_tense.length ? s.by_tense.map((t) => barRow(t.label, t.acc, t.seen)) : h('p.muted.small', 'Nothing yet.')),
    h('div.card', h('h3', 'Accuracy by topic'),
      s.topics.length ? s.topics.map((t) => barRow(t.topic, t.acc, t.seen)) : h('p.muted.small', 'Nothing yet.'))));
}
