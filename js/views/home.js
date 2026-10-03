// Today: streak, quick stats, the "Today" session button.
import { h, api, toast, exportProgress, chapterHref } from '../ui.js';
import { isStatic } from '../backend.js';
import { refreshBoot, go } from '../app.js';

export default async function (main) {
  const b = await refreshBoot();
  const t = b.today || {};
  const acc = t.answers ? Math.round(100 * t.correct / t.answers) : null;
  const done = b.units.filter((u) => u.completed).length;
  main.append(h('div',
    h('h1', '¡Hola, che!'),
    h('p.muted', 'Argentine Spanish, the way it is spoken in Buenos Aires. Vos, never tú.'),
    b.backup_due ? backupReminder() : null,
    h('div.card.center',
      h('p', b.due ? `${b.due} review${b.due === 1 ? ' is' : 's are'} waiting for you.`
        : 'About 15 minutes: reviews that are due, something new, and your recent mistakes.'),
      h('button.btn.primary.big', { onclick: () => go('#/session/today'), autofocus: true }, '▶  Today’s session'),
      h('p.small.muted.kbd-hint', { style: 'margin-top:10px' },
        'Tip: Enter submits, Enter again continues, number keys pick answers.')),
    h('div.card',
      h('h3', 'Your path'),
      pathCard(b),
      h('div.row', { style: 'margin-top:10px' },
        h('button.btn', { onclick: () => go('#/learn') }, 'All chapters'),
        h('button.btn', { onclick: () => go('#/practice') }, 'Free practice'),
        h('button.btn', { onclick: () => go('#/notebook') }, 'Mistake Notebook'))),
    h('div.grid',
      h('div.card.stat', h('div.n', '🔥 ' + (b.streak || 0)), h('div.l', 'day streak')),
      h('div.card.stat', h('div.n', String(t.answers || 0)),
        h('div.l', 'answers today' + (acc === null ? '' : ` · ${acc}% right`))),
      h('div.card.stat', h('div.n', `${done}/${b.units.length}`), h('div.l', 'chapters done')),
      h('div.card.stat', h('div.n', String(b.counts.vocab)), h('div.l', 'words & phrases in the app'))),
    b.content_errors && b.content_errors.length
      ? h('div.card', h('h3', 'Content problems'), h('ul', b.content_errors.map((e) => h('li.small', e)))) : null,
  ));
}

// Every two weeks (when there is real progress): why and how to keep a copy of the progress file.
function backupReminder() {
  const card = h('div.tip',
    h('p', h('b', 'Back up your progress. '), isStatic
      ? 'Your progress is saved only inside this app on this device. If the app icon is deleted, the browser data is '
        + 'cleared or you change phones, it is gone for good — unless you have a copy.'
      : 'Your progress is saved on this computer. A copy somewhere else keeps it safe if the computer breaks or is replaced.'),
    h('p', h('b', 'How: '), 'tap ⚙️ Settings (the last item in the top menu — on a phone, swipe the menu left) → “Your progress file” → ⬇ Export, and keep the file '
      + '(in Files, Google Drive, or e-mail it to yourself). To bring it back later: the same place → ⬆ Import. '
      + 'Or just use the button below.'),
    h('div.row', { style: 'margin-top:8px' },
      h('button.btn.primary', { onclick: async () => {
        await exportProgress(); card.remove(); toast('Progress exported — keep that file somewhere safe.', 4000);
      } }, '⬇ Back up now'),
      h('button.btn', { onclick: async () => {
        const d = new Date(Date.now() + 7 * 864e5);
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        await api('settings', { backup_snooze: day }); card.remove();
      } }, 'Remind me in a week')));
  return card;
}

const ICON = { tense: '🔤', irregular: '⚡', topic: '💬', general: '☕', reading: '📖' };

async function moveOn(cs) {
  await api('course/stage', { stage: 'next' });
  toast(`Stage ${cs.next_stage.n}: ${cs.next_stage.title}. ¡Vamos!`);
  go('#/learn');
}

// The course path: current stage, next chapter — or, when the stage is done, the next stage.
function pathCard(b) {
  const cs = b.course;
  if (!cs) return h('p.muted', 'No chapters yet.');
  const st = cs.stages[cs.current];
  const head = h('div',
    h('div.row.between', h('b', `Stage ${st.n} of ${cs.stages.length} · ${st.title}`),
      h('span.small.muted', `${st.done}/${st.count} chapters`)),
    h('div.bar.good', { style: 'margin:6px 0 10px' }, h('i', { style: `width:${st.count ? 100 * st.done / st.count : 0}%` })));
  if (cs.next) {
    const ch = cs.next;
    return h('div', head,
      h('div.small.muted', ch.started ? 'Continue:' : 'Next chapter:'),
      h('a.unit.next', { href: chapterHref(ch) }, h('div.num', String(ch.pos)),
        h('div', h('div.t', `${ICON[ch.kind] || ''} ${ch.title}`), h('div.g', ch.goal || ''))),
      cs.next_stage ? h('div.small', { style: 'margin-top:8px' },
        h('a', { href: '#/home', onclick: (e) => {
          e.preventDefault();
          if (confirm(`Move on to Stage ${cs.next_stage.n} (${cs.next_stage.title}) now? The chapters you leave stay open, and you can come back any time.`)) moveOn(cs);
        } }, `Already know this stage? Move on to Stage ${cs.next_stage.n} · ${cs.next_stage.title}`)) : null);
  }
  if (!cs.next_stage) return h('div', head, h('p', '¡Felicitaciones! You have been through the whole path.'));
  if (cs.finished) {
    return h('div', head,
      h('div.tip', h('b', `🎉 Stage ${st.n} done. `), `Next: Stage ${cs.next_stage.n} · ${cs.next_stage.title}. `
        + 'Earlier stages keep coming back in Today’s reviews.'),
      h('div.row', { style: 'margin-top:8px' },
        h('button.btn.primary', { onclick: () => moveOn(cs) }, `Start Stage ${cs.next_stage.n}`)));
  }
  // all chapters done, but the stage's tense is not comfortable yet: one tense at a time
  const g = cs.goals.find((x) => !x.ok) || cs.goals[0];
  const status = g.answers < cs.goal_min
    ? `you have answered ${g.answers} question${g.answers === 1 ? '' : 's'} in it so far`
    : `${g.accuracy}% right over your last ${g.answers} answers`;
  return h('div', head,
    h('div.tip', h('b', 'All chapters done. '),
      `Before the next tense, get comfortable with the ${g.label}: ${status}. `
      + `The goal is ${cs.goal_pct}% right over at least ${cs.goal_min} answers.`),
    h('div.row', { style: 'margin-top:8px' },
      h('button.btn.primary', { onclick: () => go('#/practice/tense/' + g.tense) }, `Practise the ${g.label}`),
      h('button.btn', { onclick: () => moveOn(cs) }, `Move on to Stage ${cs.next_stage.n} anyway`)));
}
