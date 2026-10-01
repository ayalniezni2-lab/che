// Culture & usage notes, plus every dialogue and mini-reading with its comprehension questions.
import { api, h, md, exampleRow, regTag } from '../ui.js';
import { dialogueBlock } from './unit.js';
import { runSequence } from '../exercise.js';

export default async function (main, [kind, id]) {
  if (kind === 'd' && id) return showDialogue(main, id);
  const data = await api('culture');
  const dialogs = data.dialogues.slice().sort((a, b) => (a.level || '').localeCompare(b.level || ''));
  main.append(h('div',
    h('h1', 'Culture & real-life Spanish'),
    h('p.muted', 'How people actually talk in Buenos Aires: the glue words, the slang, and everyday situations.'),
    h('h2', 'Dialogues & readings'),
    h('div.grid', dialogs.map((d) => h('a.unit', { href: '#/culture/d/' + encodeURIComponent(d.id), style: 'margin:0' },
      h('div.num', d.kind === 'reading' ? '📖' : '💬'),
      h('div', h('div.t', d.title), h('div.g', [(d.level || '').toUpperCase(), d.setting].filter(Boolean).join(' · ')))))),
    dialogs.length ? null : h('p.muted.small', 'None yet.'),
    h('h2', 'Usage notes'),
    data.notes.map((n) => h('details.card', h('summary', { style: 'cursor:pointer;font-weight:600' }, n.title, ' ',
      n.reg && n.reg !== 'neutral' ? regTag(n.reg) : null, ' ', h('span.tag.level', (n.level || '').toUpperCase())),
    h('div.md', { html: md(n.md) }), (n.examples || []).map(exampleRow))),
    data.notes.length ? null : h('p.muted.small', 'None yet.')));
  return null;
}

async function showDialogue(main, id) {
  const d = await api('dialogue/' + encodeURIComponent(id));
  let stop = null;
  const lesson = () => {
    if (stop) { stop(); stop = null; }
    main.replaceChildren(h('div', h('a.small', { href: '#/culture' }, '← Culture & dialogues'), h('h1', d.title),
      d.intro ? h('p.muted', d.intro) : null, dialogueBlock(d),
      d.questions.length ? h('div.card.center', h('button.btn.primary.big', { onclick: quiz }, `Check your understanding (${d.questions.length}) →`)) : null));
  };
  const quiz = () => {
    const stage = h('div');
    main.replaceChildren(h('details.card', h('summary', { style: 'cursor:pointer' }, 'Show the text again'), dialogueBlock(d)), stage);
    stop = runSequence(stage, d.questions, { title: d.title, ctx: { dialogue: d.id }, onFinish: (res) => {
      stage.replaceChildren(h('div.card.center', h('h2', `${res.right} / ${res.total}`),
        h('div.row', { style: 'justify-content:center' }, h('button.btn', { onclick: lesson }, 'Back to the text'),
          h('a.btn.primary', { href: '#/culture' }, 'More dialogues'))));
    } });
  };
  lesson();
  return () => { if (stop) stop(); };
}
