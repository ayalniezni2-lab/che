// Mistake Notebook: every wrong answer with its diagnosis, filterable by topic and kind of mistake.
import { api, h, md, accentMarked, conjTable, whyText, playBtn, exampleRow, toast } from '../ui.js';
import { runSequence } from '../exercise.js';

const KIND_LABEL = {
  wrong_person: 'right tense, wrong person', wrong_tense: 'right person, wrong tense', wrong_form: 'wrong person and tense',
  tu_form: 'tú form (Spain/Mexico)', vosotros_form: 'vosotros form (Spain)', regularized: 'regular pattern on an irregular verb',
  spelling_rule: 'missed spelling change', stem_change_vos: 'vowel change on vos / nosotros', ser_estar: 'ser vs estar',
  por_para: 'por vs para', agreement: 'gender / number agreement', verb_choice: 'confusable verbs', other_verb: 'different verb',
  verb_spelling: 'verb ending spelling', verb_form: 'verb form', missing_reflexive: 'missing me/te/se', wrong_reflexive: 'wrong me/te/se',
  accent_pair: 'look-alike words (accent / ñ)', word_order: 'word order', missing_word: 'missing word', extra_word: 'extra word', wrong_word: 'wrong word', spelling: 'spelling',
  spain_word: 'Spain / neutral word', match: 'matching', blank: 'left blank', other: 'other',
};

export default async function (main) {
  const state = { show: 'open', topic: '', kind: '' };
  let stop = null;
  const list = h('div');
  const head = h('div');
  main.append(h('h1', 'Mistake Notebook'),
    h('p.muted', 'Every mistake is kept here with its explanation. Get it right twice in a row and it moves to “Fixed”.'), head, list);

  async function load() {
    if (stop) { stop(); stop = null; }
    const q = new URLSearchParams(state).toString();
    const data = await api('notebook?' + q);
    const sel = (key, options, label) => h('select.sel', { onchange: (e) => { state[key] = e.target.value; load(); } },
      h('option', { value: '' }, label), options.map(([v, l]) => h('option', { value: v, selected: state[key] === v }, l)));
    head.replaceChildren(h('div.row', { style: 'margin:10px 0' },
      h('select.sel', { onchange: (e) => { state.show = e.target.value; load(); } },
        [['open', `To fix (${data.open})`], ['resolved', 'Fixed'], ['all', `All (${data.total})`]].map(([v, l]) =>
          h('option', { value: v, selected: state.show === v }, l))),
      sel('topic', data.topics, 'All topics'),
      sel('kind', data.kinds.map((k) => [k, KIND_LABEL[k] || k]), 'All kinds of mistake'),
      data.items.length ? h('button.btn.primary', { onclick: () => review(data.items) }, `Practise these (${Math.min(data.items.length, 20)})`) : null));
    list.replaceChildren(...(data.items.length ? data.items.map(card) : [h('div.card.center', h('p.muted',
      state.show === 'open' ? 'Nothing to fix right now. ¡Bien ahí!' : 'Nothing here.'))]));
  }

  function card(m) {
    const details = h('div.hidden',
      m.table ? conjTable(m.table) : null,
      m.why ? h('div.why', { html: '<b>Why:</b> ' + md(whyText(m.why, m.table)) }) : null,
      m.extra ? exampleRow(m.extra) : null,
      h('div.row', h('button.btn.ghost.danger.small', { onclick: async () => { await api('notebook/remove', { id: m.id }); toast('Removed.'); load(); } }, 'Remove from notebook')));
    return h('div.card',
      h('div.row.between',
        h('div.row', h('span.tag.level', m.topic_label || m.topic || 'general'), (m.kinds || []).map((k) => h('span.tag.slang', KIND_LABEL[k] || k)),
          m.resolved ? h('span.tag.informal', 'fixed') : null),
        h('span.small.muted', `${m.count}× · last ${String(m.last || '').slice(0, 10)}`)),
      m.prompt ? h('div.small.muted', { style: 'margin-top:6px' }, [m.prompt, m.en].filter(Boolean).join(' — ')) : null,
      m.ex && m.ex.inf ? h('div', h('span.es', m.ex.inf), h('span.muted', ` · ${m.ex.tense_label || ''}${m.ex.person_label ? ' · ' + m.ex.person_label : ''}${m.ex.gloss ? ' · “' + m.ex.gloss + '”' : ''}`)) : null,
      m.es ? h('div.es', { html: accentMarked(m.es) }) : null,
      h('div.versus',
        h('div.yours', h('div.lbl', 'You wrote'), h('div.val', m.typed || '—')),
        h('div.correct', h('div.lbl', 'Correct'), h('div.row', h('div.val', { html: accentMarked(m.expected || '') }), playBtn(m.audio)))),
      (m.diagnosis || []).length ? h('div.diag', h('ul', m.diagnosis.map((d) => h('li', { html: md(d).replace(/^<p>|<\/p>$/g, '') })))) : null,
      h('button.btn.ghost.small', { onclick: (e) => { details.classList.toggle('hidden'); e.target.textContent = details.classList.contains('hidden') ? 'Show table and explanation ▾' : 'Hide ▴'; } }, 'Show table and explanation ▾'),
      details);
  }

  function review(items) {
    const exs = items.filter((m) => m.ex && m.ex.type).slice(0, 20).map((m) => m.ex);
    if (!exs.length) return;
    head.replaceChildren();
    stop = runSequence(list, exs, { title: 'Mistake review', ctx: { notebook: true }, onFinish: () => load() });
  }

  await load();
  return () => { if (stop) stop(); };
}
