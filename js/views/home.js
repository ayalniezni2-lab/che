// Today: streak, quick stats, the "Today" session button.
import { h, api, toast, exportProgress } from '../ui.js';
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
      h('p', b.due ? `${b.due} reviews are waiting for you.`
        : 'About 15 minutes: reviews that are due, something new, and your recent mistakes.'),
      h('button.btn.primary.big', { onclick: () => go('#/session/today'), autofocus: true }, '▶  Today’s session'),
      h('p.small.muted.kbd-hint', { style: 'margin-top:10px' },
        'Tip: Enter submits, Enter again continues, number keys pick answers.')),
    h('div.grid',
      h('div.card.stat', h('div.n', '🔥 ' + (b.streak || 0)), h('div.l', 'day streak')),
      h('div.card.stat', h('div.n', String(t.answers || 0)),
        h('div.l', 'answers today' + (acc === null ? '' : ` · ${acc}% right`))),
      h('div.card.stat', h('div.n', `${done}/${b.units.length}`), h('div.l', 'units finished')),
      h('div.card.stat', h('div.n', String(b.counts.vocab)), h('div.l', 'words & phrases in the app'))),
    h('div.card',
      h('h3', 'Keep going'),
      nextUnit(b),
      h('div.row', { style: 'margin-top:10px' },
        h('button.btn', { onclick: () => go('#/learn') }, 'All units'),
        h('button.btn', { onclick: () => go('#/practice') }, 'Free practice'),
        h('button.btn', { onclick: () => go('#/notebook') }, 'Mistake Notebook'))),
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

function nextUnit(b) {
  const next = b.next_unit;
  if (!next) {
    return h('p.muted', b.units.length
      ? 'You finished every unit. Type "refill" in Claude Code for more.' : 'No units yet.');
  }
  const link = h('a.unit', { href: '#/unit/' + encodeURIComponent(next.id) },
    h('div.num', String(next.order || '•')),
    h('div', h('div.t', next.title), h('div.g', next.goal || '')));
  const hd = next.hold;
  if (!hd) return link;
  // one tense at a time: the next lesson starts a new tense, the current one is not comfortable yet
  const status = hd.answers < hd.min_answers
    ? `you have answered ${hd.answers} question${hd.answers === 1 ? '' : 's'} in it so far`
    : `${hd.accuracy}% right over your last ${hd.answers} answers`;
  return h('div',
    h('div.tip', h('b', 'One tense at a time. '),
      `The next lesson starts something new (the ${hd.new_label}). First get comfortable with the ${hd.label}: `
      + `${status}. The goal is ${hd.goal}% right over at least ${hd.min_answers} answers.`),
    h('div.row', { style: 'margin:8px 0' },
      h('button.btn.primary', { onclick: () => go('#/practice/tense/' + hd.tense) }, `Practise the ${hd.label}`),
      h('a.btn', { href: '#/unit/' + encodeURIComponent(next.id) }, 'Go to the next lesson anyway')),
    h('div.small.muted', 'Next lesson:'), link);
}
