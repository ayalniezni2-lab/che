// Verb browser: look up any verb and see every table in the Argentine 6-person layout.
import { api, h, md, conjTable, playBtn, regTag, accentMarked } from '../ui.js';

const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default async function (main, [inf]) {
  if (inf) return showVerb(main, inf);
  const { verbs } = await api('verbs');
  const list = h('div.grid');
  const search = h('input.search', { type: 'text', placeholder: 'Search: tener, to have…', style: 'width:100%;max-width:420px' });
  const level = h('select.sel', h('option', { value: '' }, 'All levels'),
    ['a1', 'a2', 'b1', 'b2'].map((l) => h('option', { value: l }, l.toUpperCase())));
  const only = h('select.sel', h('option', { value: '' }, 'All verbs'), h('option', { value: 'irr' }, 'Irregular only'));
  const draw = () => {
    const q = fold(search.value.trim());
    const shown = verbs.filter((v) => (!q || fold(v.inf).includes(q) || fold(v.en || '').includes(q))
      && (!level.value || v.level === level.value) && (!only.value || v.irregular));
    list.replaceChildren(...shown.map((v) => h('a.unit', { href: '#/verbs/' + encodeURIComponent(v.inf), style: 'margin:0' },
      h('div', { style: 'flex:1' }, h('div.t', h('span.es', v.inf), ' ', v.irregular ? h('span.tag.slang', 'irregular') : null,
        v.reg !== 'neutral' ? regTag(v.reg) : null), h('div.g', v.en)))));
  };
  [search, level, only].forEach((el) => el.addEventListener('input', draw));
  main.append(h('h1', 'Verbs'),
    h('p.muted', `${verbs.length} verbs, most-used first. Every table uses the Argentine layout: yo · vos · él/ella/usted · nosotros · ustedes · ellos/ellas.`),
    h('div.row', { style: 'margin:12px 0' }, search, level, only), list);
  draw();
  setTimeout(() => search.focus(), 30);
}

async function showVerb(main, inf) {
  const v = await api('verb/' + encodeURIComponent(inf));
  main.append(h('div', h('a.small', { href: '#/verbs' }, '← All verbs'),
    h('div.row', { style: 'margin-top:8px' }, h('h1', { style: 'margin:0' }, h('span.es', { html: accentMarked(v.inf) })), playBtn(v.audio),
      v.reg !== 'neutral' ? regTag(v.reg) : null),
    h('p.muted', v.en), v.note ? h('div.tip.small', v.note) : null,
    h('div.grid', { style: 'grid-template-columns:repeat(auto-fit,minmax(320px,1fr))' },
      v.tables.filter(Boolean).map((t) => h('div.card', { style: 'margin:0' }, conjTable(t))))));
}
