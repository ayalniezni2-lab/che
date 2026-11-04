// Learn: the path, stage by stage (one tense at a time). Every chapter is open — the path only suggests the order.
// Each stage: the basics, then its ✅ check, then the extras. Word chapters (📚) have their own list (#/wch).
import { h, api, toast, chapterHref, KIND_ICON } from '../ui.js';
import { refreshBoot, go } from '../app.js';

export { KIND_ICON };
const KIND_HELP = [['🔤', 'new tense'], ['⚡', 'irregular verbs'], ['✅', 'check'], ['💬', 'topic'], ['☕', 'extra'],
  ['📖', 'reading'], ['📚', 'new words']];

export default async function (main) {
  const b = await refreshBoot();
  const cs = b.course;
  main.append(h('h1', 'Learn'),
    h('p.muted', 'One tense at a time. Each stage starts with the basics (the new tense and its irregular verbs), then a '
      + 'short check, then extra chapters: finer points, everyday topics and readings. New words come in between. '
      + 'Everything stays open — follow the path or jump wherever you like.'),
    h('p.small.muted', KIND_HELP.map(([i, l]) => `${i} ${l}`).join('   ·   ')));
  if (!cs) return;
  const nextId = cs.next && cs.next.id;
  const w = cs.words;
  if (w) {
    main.append(h('div.card',
      h('div.row.between', h('h3', { style: 'margin:0' }, '📚 New words'), h('span.small.muted', `${w.done}/${w.count} done`)),
      h('p.small.muted', 'Short chapters of 10 words from the word lists. Your path brings one after every two lessons.'),
      w.next ? h('a.unit' + (w.next.id === nextId ? '.next' : ''), { href: chapterHref(w.next) }, h('div.num', '📚'),
        h('div', h('div.t', w.next.title), h('div.g', w.next.id === nextId ? 'Next on your path' : 'Next word chapter'))) : null,
      h('div.row', { style: 'margin-top:8px' }, h('a.btn.small', { href: '#/wch' }, 'All word chapters'))));
  }
  for (const st of cs.stages) {
    const rows = [h('div.small.muted.part', 'The basics')];
    for (const ch of st.chapters) {
      rows.push(row(ch));
      if (ch.kind === 'check') rows.push(h('div.small.muted.part', 'Extra chapters'));
    }
    main.append(stageCard(st, h('div', rows)));
  }

  function row(ch) {
    return h('a.unit' + (ch.completed ? '.done' : '') + (ch.id === nextId ? '.next' : ''),
      { href: chapterHref(ch) },
      h('div.num', ch.completed ? (ch.skipped ? '↷' : '✓') : String(ch.pos)),
      h('div', { style: 'flex:1' },
        h('div.t', `${KIND_ICON[ch.kind] || ''} ${ch.title}`),
        h('div.g', ch.id === nextId ? 'Next on your path' : ch.skipped ? 'Skipped — you already know it' : (ch.goal || ''))),
      ch.best != null && !ch.skipped ? h('span.small.muted', Math.round(ch.best * 100) + '%') : null);
  }

  function stageCard(st, list) {
    const moveBtn = st.current ? null : h('button.btn.small', { onclick: async () => {
      await api('course/stage', { stage: st.id });
      toast(`Stage ${st.n} is now your current stage.`); go('#/home');
    } }, st.n > cs.stages[cs.current].n ? 'Start this stage now' : 'Go back to this stage');
    const open = st.current || st.n === cs.stages[cs.current].n + 1;
    return (h('details.card.stage' + (st.current ? '.current' : ''), { open },
      h('summary', h('div.row.between', { style: 'width:100%' },
        h('h2', { style: 'margin:0' }, `Stage ${st.n} · ${st.title} `, st.current ? h('span.tag', 'you are here') : null),
        h('span.muted.small', `${st.done}/${st.count} done`))),
      st.intro ? h('p.muted.small', st.intro) : null,
      h('div.bar.good', { style: 'margin:8px 0 12px' }, h('i', { style: `width:${st.count ? 100 * st.done / st.count : 0}%` })),
      list,
      moveBtn ? h('div.row', { style: 'margin-top:10px' }, moveBtn) : null));
  }
}
