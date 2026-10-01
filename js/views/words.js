// Vocabulary browser: every word has its English, an example, a register tag and audio.
import { api, h, accentMarked, playBtn, regTag } from '../ui.js';

export default async function (main) {
  const state = { q: '', level: '', topic: '', reg: '', offset: 0 };
  const list = h('div');
  const info = h('div.small.muted');
  const more = h('button.btn', { onclick: () => { state.offset += 100; load(true); } }, 'Show more');
  const search = h('input.search', { type: 'text', placeholder: 'Search in Spanish or English…', style: 'flex:1;min-width:220px' });
  const level = h('select.sel', h('option', { value: '' }, 'All levels'), ['a1', 'a2', 'b1', 'b2'].map((l) => h('option', { value: l }, l.toUpperCase())));
  const reg = h('select.sel', h('option', { value: '' }, 'All registers'), ['neutral', 'informal', 'slang', 'vulgar'].map((r) => h('option', { value: r }, r)));
  const topic = h('select.sel', h('option', { value: '' }, 'All topics'));
  let timer = null;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = search.value; state.offset = 0; load(); }, 200); });
  level.addEventListener('change', () => { state.level = level.value; state.offset = 0; load(); });
  reg.addEventListener('change', () => { state.reg = reg.value; state.offset = 0; load(); });
  topic.addEventListener('change', () => { state.topic = topic.value; state.offset = 0; load(); });

  main.append(h('div', h('h1', 'Words & phrases'),
    h('p.muted', 'Every entry is Argentine usage, tagged neutral / informal / slang / vulgar (vulgar is hidden unless you switch it on in Settings).'),
    h('div.row', { style: 'margin:10px 0' }, search, level, topic, reg), info, list, h('div.center', { style: 'margin:14px' }, more)));

  async function load(append) {
    const data = await api('vocab?' + new URLSearchParams(state).toString());
    if (topic.options.length <= 1) data.topics.forEach((t) => topic.append(h('option', { value: t }, t)));
    info.textContent = `${data.total} entries`;
    const rows = data.items.map((it) => h('div.example',
      playBtn(it.audio),
      h('div.txt',
        h('div', h('span.es', { html: accentMarked(it.es) }), ' ', regTag(it.reg), ' ', h('span.tag.level', (it.level || '').toUpperCase()),
          it.known ? h('span.tag.informal', { style: 'margin-left:4px' }, 'known') : null, h('span.en', '  ' + it.en)),
        it.ex ? h('div.small', playBtn(it.ex_audio, { slow: false }), ' ', h('span.es', { html: accentMarked(it.ex) }), h('span.en', ' — ' + (it.ex_en || ''))) : null,
        it.note ? h('div.small.muted', it.note) : null)));
    if (append) list.firstChild.append(...rows); else list.replaceChildren(h('div.card', rows.length ? rows : h('p.muted', 'Nothing found.')));
    more.classList.toggle('hidden', state.offset + 100 >= data.total);
  }
  await load();
  setTimeout(() => search.focus(), 30);
}
