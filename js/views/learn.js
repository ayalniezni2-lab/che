// Learn: levels -> units.  Every unit is always open (you can jump anywhere).
import { h } from '../ui.js';
import { refreshBoot } from '../app.js';

export default async function (main) {
  const b = await refreshBoot();
  main.append(h('h1', 'Learn'),
    h('p.muted', 'Most useful things first. Every unit is open — jump wherever you like.'));
  for (const lv of b.levels) {
    const units = b.units.filter((u) => u.level === lv.id);
    const done = units.filter((u) => u.completed).length;
    const box = h('div.card',
      h('div.row.between',
        h('h2', { style: 'margin:0' }, `${lv.name} `, h('span.tag.level', lv.cefr || lv.id.toUpperCase())),
        h('span.muted.small', `${done}/${units.length} done`)),
      lv.blurb ? h('p.muted.small', lv.blurb) : null,
      h('div.bar.good', { style: 'margin:8px 0 12px' },
        h('i', { style: `width:${units.length ? 100 * done / units.length : 0}%` })));
    units.forEach((u, i) => box.append(
      h('a.unit' + (u.completed ? '.done' : ''), { href: '#/unit/' + encodeURIComponent(u.id) },
        h('div.num', u.completed ? '✓' : String(i + 1)),
        h('div', { style: 'flex:1' }, h('div.t', u.title), h('div.g', u.goal || '')),
        u.best != null ? h('span.small.muted', Math.round(u.best * 100) + '%') : null)));
    if (!units.length) box.append(h('p.muted.small', 'Nothing here yet.'));
    main.append(box);
  }
}
