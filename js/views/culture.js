// Reading: usage notes, plus every dialogue and mini-reading with its comprehension questions.
import { api, h, md, exampleRow, regTag, chapterHref, prefetchAudio, audioOf } from '../ui.js';
import { dialogueBlock } from './unit.js';
import { runSequence } from '../exercise.js';

export default async function (main, [kind, id]) {
  if (kind === 'd' && id) return showDialogue(main, id);
  const data = await api('culture');
  const dialogs = data.dialogues.slice().sort((a, b) => (a.level || '').localeCompare(b.level || ''));
  main.append(h('div',
    h('h1', 'Reading'),
    h('p.muted', 'Dialogues and short readings in everyday Buenos Aires Spanish, each with questions, plus short notes on how people really say things.'),
    h('h2', 'Dialogues & readings'),
    h('div.grid', dialogs.map((d) => h('a.unit', { href: '#/culture/d/' + encodeURIComponent(d.id), style: 'margin:0' },
      h('div.num', d.listen_first ? '🎧' : d.kind === 'reading' ? '📖' : '💬'),
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
  let heard = false;                          // listen-first readings: the text appears after the questions
  prefetchAudio(d.lines.map((l) => l.audio).concat(audioOf(d.questions)));
  const lesson = () => {
    if (stop) { stop(); stop = null; }
    const ch = d.chapter;
    const listenFirst = d.listen_first && !heard;
    main.replaceChildren(h('div',
      h('a.small', { href: ch ? '#/learn' : '#/culture' }, ch ? '← Learn' : '← Reading'),
      ch ? h('div.small.muted', { style: 'margin-top:6px' }, `Stage ${ch.stage_n} · chapter ${ch.pos} of ${ch.count} · 📖 Reading`) : null,
      h('h1', d.title),
      listenFirst ? h('div.intro', h('div.label', '🎧 Listen first'), h('div', 'This one is for your ears: press ▶ Play all '
        + '(as often as you like), then answer the questions. The text appears after the questions.'))
        : ch ? h('div.intro', h('div.label', '📖 Reading chapter'), h('div', 'Read the text below (tap ▶ to hear each line, '
          + 'tap a line for its English), then answer the questions about it. 70% ticks the chapter off.')) : null,
      d.intro ? h('p.muted', d.intro) : null,
      dialogueBlock(d, { hideEnglish: true, hideText: listenFirst }),
      d.questions.length ? h('div.card.center', h('button.btn.primary.big', { onclick: quiz }, `Check your understanding (${d.questions.length}) →`)) : null));
  };
  const quiz = () => {
    const stage = h('div');
    // during the questions: the Spanish only (the English would give the answers away); listen-first: sound only
    main.replaceChildren(h('details.card', h('summary', { style: 'cursor:pointer' },
      d.listen_first && !heard ? 'Listen again' : 'Show the text again (Spanish only)'),
    dialogueBlock(Object.assign({}, d, { lines: d.lines.map((l) => Object.assign({}, l, { en: '' })) }),
      { hideText: d.listen_first && !heard })), stage);
    stop = runSequence(stage, d.questions, { title: d.title, ctx: { dialogue: d.id }, onFinish: async (res) => {
      stop = null;
      if (res.aborted) { lesson(); return; }
      heard = true;
      let out = null;
      if (d.chapter) out = await api('course/reading', { id: d.id, right: res.right, total: res.total });
      stage.replaceChildren(h('div.card.center', h('h2', `${res.right} / ${res.total}`),
        out ? h('p.muted', out.passed ? 'Chapter complete.' : 'You need 70% to tick this chapter off — read the text again and retry.') : null,
        h('div.row', { style: 'justify-content:center' }, h('button.btn', { onclick: lesson }, d.listen_first ? 'Now read the text' : 'Back to the text'),
          d.next_chapter ? h('a.btn.primary', { href: chapterHref(d.next_chapter) }, 'Next chapter →')
            : h('a.btn.primary', { href: '#/culture' }, 'More dialogues'))));
    } });
  };
  lesson();
  return () => { if (stop) stop(); };
}
