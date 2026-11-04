// Today = 1. the next chapter on your path (a lesson, a reading, the stage check or new words), 2. a quick review
// (your open mistakes + the reviews most due). #/session/review runs the quick review on its own; #/session/mix is
// the Big review (the old mixed session: reviews, new words, listening and drills).
// A review stopped half-way can be continued the same day (kept in this browser).
import { api, h, chapterHref, prefetchAudio, audioOf, startTodayFlow, KIND_ICON, toast } from '../ui.js';
import { runSequence, savedPlace, forgetPlace } from '../exercise.js';
import { go, refreshBoot } from '../app.js';

export default async function (main, [mode]) {
  if (mode === 'review') return reviewRun(main, { endpoint: 'session/review', key: 'che-resume:review', title: 'Quick review' });
  if (mode === 'mix') return reviewRun(main, { endpoint: 'session/mix', key: 'che-resume:today', title: 'Big review', mix: true });
  return plan(main);
}

async function plan(main) {
  main.append(h('p.muted.boot-status', 'Looking at your path…'));
  const t = await api('session/today', {});
  const ch = t.chapter;
  const parts = [];
  if (t.done_today.length) {
    parts.push(h('div.tip.small', { style: 'text-align:left' }, h('b', '✓ Done today: '), t.done_today.join(' · ')));
  }
  if (ch) {
    parts.push(h('div.card', { style: 'text-align:left' },
      h('div.small.muted', `1 · ${ch.started && !ch.completed ? 'Continue' : 'Your next chapter'} · Stage ${t.stage.n} · ${t.stage.title}`),
      h('a.unit.next', { href: chapterHref(ch), onclick: () => startTodayFlow(ch.id) },
        h('div.num', KIND_ICON[ch.kind] || String(ch.pos)),
        h('div', h('div.t', ch.title), h('div.g', ch.goal || ''))),
      h('button.btn.primary.big', { style: 'margin-top:10px', autofocus: true,
        onclick: () => { startTodayFlow(ch.id); go(chapterHref(ch)); } }, 'Start →')));
  } else {
    parts.push(stageDone(t));
  }
  parts.push(h('div.card', { style: 'text-align:left' },
    h('div.small.muted', `${ch ? '2' : '1'} · Quick review`),
    t.review_n ? h('p', `${t.review_n} question${t.review_n === 1 ? '' : 's'}: your open mistakes and the reviews that are most due.`
      + (ch ? ' It comes right after the chapter.' : ''))
      : h('p.muted', 'Nothing to review right now.'),
    h('div.row',
      t.review_n ? h('button.btn' + (ch ? '' : '.primary'), { onclick: () => go('#/session/review') },
        ch ? 'Just the review' : 'Start the review') : null,
      t.due_total > 3 * (t.review_n || 1)
        ? h('button.btn.ghost', { onclick: () => go('#/session/mix'), title: 'Reviews, words, listening and drills, all mixed' },
          `Big review (${t.due_total} waiting)`) : null)));
  main.replaceChildren(h('div', h('h1', 'Today'), ...parts,
    h('p.small.muted.kbd-hint', 'Enter submits · Enter again continues · number keys pick answers')));
  return null;
}

// The stage's chapters are all done: start the next stage (or, if its tense is shaky, a workout first).
function stageDone(t) {
  if (!t.next_stage) return h('div.card.center', h('p', '¡Felicitaciones! You have been through the whole path.'));
  const moveOn = async () => {
    await api('course/stage', { stage: 'next' });
    await refreshBoot();
    toast(`Stage ${t.next_stage.n}: ${t.next_stage.title}. ¡Vamos!`);
    go('#/session/today');
  };
  const g = (t.goals || []).find((x) => !x.ok);
  return h('div.card', { style: 'text-align:left' },
    h('div.tip', h('b', `🎉 All chapters of Stage ${t.stage.n} done. `), `Next: Stage ${t.next_stage.n} · ${t.next_stage.title}.`),
    g && !t.stage_finished ? h('p.small.muted', `Your ${g.label} is at ${g.accuracy}% — a workout first is a good idea.`) : null,
    h('div.row', { style: 'margin-top:8px' },
      h('button.btn.primary', { onclick: moveOn }, `Start Stage ${t.next_stage.n}`),
      g && !t.stage_finished ? h('a.btn', { href: '#/practice/tense/' + g.tense }, `Practise the ${g.label}`) : null));
}

// A run of questions (the quick review, or the Big review), with "continue where I left off" for today.
async function reviewRun(main, { endpoint, key, title, mix = false }) {
  let stop = null;
  let begin = () => {};
  const startedAt = Date.now();
  function onKey(e) { if (e.key === 'Enter' && !stop) { e.preventDefault(); document.removeEventListener('keydown', onKey); begin(); } }

  const finished = async (res) => {
    stop = null;
    const out = await api('session/finish', {});
    await refreshBoot();
    const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const nxt = (await api('course').catch(() => null)) || {};
    const nu = nxt.next || null;
    main.replaceChildren(h('div.card.center',
      h('h1', res.aborted ? 'Paused' : '¡Listo por hoy!'),
      h('p', `${res.right} of ${res.total} right on the first try · about ${mins} min · 🔥 ${out.streak}-day streak`),
      res.aborted ? h('p.small.muted', 'Your place is kept — open it again today to continue from here.') : null,
      nu ? h('div', { style: 'max-width:520px;margin:14px auto;text-align:left' }, h('div.small.muted', 'Next on your path'),
        h('a.unit', { href: chapterHref(nu) }, h('div.num', KIND_ICON[nu.kind] || '→'),
          h('div', h('div.t', nu.title), h('div.g', nu.goal || '')))) : null,
      h('div.row', { style: 'justify-content:center' },
        h('button.btn', { onclick: () => go('#/home') }, 'Home'),
        h('button.btn', { onclick: () => go('#/notebook') }, 'Mistake Notebook'),
        h('button.btn.primary', { onclick: () => { location.hash = '#/practice'; } }, 'More practice'))));
  };

  const run = (items, resume) => {
    const stage = h('div');
    main.replaceChildren(stage);
    stop = runSequence(stage, items, { title, ctx: { session: mix ? 'mix' : 'review' }, resumeKey: key, resume, onFinish: finished });
  };

  const place = savedPlace(key);
  if (place) {
    const left = place.queue.filter((x) => x.type !== 'intro').length;
    main.append(h('div.card.center',
      h('h1', title),
      h('p', `You stopped half-way: ${left} question${left === 1 ? '' : 's'} left.`),
      h('div.row', { style: 'justify-content:center' },
        h('button.btn.primary.big', { onclick: () => { prefetchAudio(audioOf(place.queue)); run(place.queue, place); }, autofocus: true },
          'Continue where I left off'),
        h('button.btn', { onclick: () => { forgetPlace(key); main.replaceChildren(); fresh(); } }, 'Start again'))));
    return () => { if (stop) stop(); };
  }
  await fresh();
  return () => { document.removeEventListener('keydown', onKey); if (stop) stop(); };

  async function fresh() {
    main.append(h('p.muted.boot-status', mix ? 'Building the Big review…' : 'Picking your reviews…'));
    const s = await api(endpoint, {});
    if (!s.items.length) {
      main.replaceChildren(h('div.card.center', h('h2', 'Nothing to review right now'),
        h('p.muted', 'Your mistakes are fixed and no reviews are due. ¡Bien!'),
        h('div.row', { style: 'justify-content:center' },
          h('button.btn.primary', { onclick: () => go('#/session/today') }, 'Back to Today'))));
      return;
    }
    prefetchAudio(audioOf(s.items));
    begin = () => { document.removeEventListener('keydown', onKey); run(s.items, null); };
    if (!mix) { begin(); return; }                    // the quick review starts at once
    const sm = s.summary;
    main.replaceChildren(h('div.card.center',
      h('h1', 'Big review'),
      h('p.muted', `About ${s.minutes} minutes · ${s.items.filter((x) => x.type !== 'intro').length} questions — everything mixed: `
        + 'reviews, a few new words, listening and verb drills.'),
      sm.catching_up ? h('div.tip.small', { style: 'text-align:left' }, h('b', 'You’re catching up. '),
        `${sm.due_total} reviews were waiting, so this is mostly reviews.`) : null,
      h('div.grid.session-mix', { style: 'max-width:640px;margin:12px auto' },
        h('div.stat', h('div.n', String(sm.mistakes)), h('div.l', 'mistakes to fix')),
        h('div.stat', h('div.n', String(sm.reviews)), h('div.l', 'reviews due')),
        h('div.stat', h('div.n', String(sm.new_words)), h('div.l', 'new words')),
        sm.listening ? h('div.stat', h('div.n', String(sm.listening)), h('div.l', 'listening')) : null,
        h('div.stat', h('div.n', String(sm.drills)), h('div.l', 'drills'))),
      h('button.btn.primary.big', { onclick: begin, autofocus: true }, 'Start')));
    document.addEventListener('keydown', onKey);
  }
}
