// Learn: the path, stage by stage (one tense at a time). Every chapter is open — the path only suggests the order.
import { h, api, toast, chapterHref } from '../ui.js';
import { refreshBoot, go } from '../app.js';

export const KIND_ICON = { tense: '🔤', irregular: '⚡', topic: '💬', general: '☕', reading: '📖' };
const KIND_HELP = [['🔤', 'new tense'], ['⚡', 'irregular verbs'], ['💬', 'topic'], ['☕', 'break'], ['📖', 'reading']];

export default async function (main) {
  const b = await refreshBoot();
  const cs = b.course;
  main.append(h('h1', 'Learn'),
    h('p.muted', 'One tense at a time: each stage brings a new tense, its irregular verbs and everyday topics, with breaks '
      + 'in between. Everything stays open — follow the path or jump wherever you like.'),
    h('p.small.muted', KIND_HELP.map(([i, l]) => `${i} ${l}`).join('   ·   ')));
  if (!cs) return;
  const nextId = cs.next && cs.next.id;
  for (const st of cs.stages) {
    const list = h('div', st.chapters.map((ch) => h('a.unit' + (ch.completed ? '.done' : '') + (ch.id === nextId ? '.next' : ''),
      { href: chapterHref(ch) },
      h('div.num', ch.completed ? (ch.skipped ? '↷' : '✓') : String(ch.pos)),
      h('div', { style: 'flex:1' },
        h('div.t', `${KIND_ICON[ch.kind] || ''} ${ch.title}`),
        h('div.g', ch.id === nextId ? 'Next on your path' : ch.skipped ? 'Skipped — you already know it' : (ch.goal || ''))),
      ch.best != null && !ch.skipped ? h('span.small.muted', Math.round(ch.best * 100) + '%') : null)));
    const moveBtn = st.current ? null : h('button.btn.small', { onclick: async () => {
      await api('course/stage', { stage: st.id });
      toast(`Stage ${st.n} is now your current stage.`); go('#/home');
    } }, st.n > cs.stages[cs.current].n ? 'Start this stage now' : 'Go back to this stage');
    const open = st.current || st.n === cs.stages[cs.current].n + 1;
    main.append(h('details.card.stage' + (st.current ? '.current' : ''), { open },
      h('summary', h('div.row.between', { style: 'width:100%' },
        h('h2', { style: 'margin:0' }, `Stage ${st.n} · ${st.title} `, st.current ? h('span.tag', 'you are here') : null),
        h('span.muted.small', `${st.done}/${st.count} done`))),
      st.intro ? h('p.muted.small', st.intro) : null,
      h('div.bar.good', { style: 'margin:8px 0 12px' }, h('i', { style: `width:${st.count ? 100 * st.done / st.count : 0}%` })),
      list,
      moveBtn ? h('div.row', { style: 'margin-top:10px' }, moveBtn) : null));
  }
}
