// Today's session: mistakes to fix + due reviews + a few new words + listening + weighted drills.
// A session stopped half-way can be continued the same day (kept in this browser).
import { api, h, chapterHref, prefetchAudio, audioOf } from '../ui.js';
import { runSequence, savedPlace, forgetPlace } from '../exercise.js';
import { go, refreshBoot } from '../app.js';

const KEY = 'che-resume:today';

export default async function (main) {
  let stop = null;
  let begin = () => {};
  const startedAt = Date.now();

  const finished = async (res) => {
    const out = await api('session/finish', {});
    await refreshBoot();
    const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const nxt = (await api('course').catch(() => null)) || {};
    const nu = nxt.next || null;
    main.replaceChildren(h('div.card.center',
      h('h1', res.aborted ? 'Session paused' : '¡Listo por hoy!'),
      h('p', `${res.right} of ${res.total} right on the first try · about ${mins} min · 🔥 ${out.streak}-day streak`),
      res.aborted ? h('p.small.muted', 'Your place is kept — “Today’s session” continues from here (today only).') : null,
      nu ? h('div', { style: 'max-width:520px;margin:14px auto;text-align:left' }, h('div.small.muted', 'Next chapter on your path'),
        h('a.unit', { href: chapterHref(nu) }, h('div.num', '→'),
          h('div', h('div.t', nu.title), h('div.g', nu.goal || '')))) : null,
      h('div.row', { style: 'justify-content:center' },
        h('button.btn', { onclick: () => go('#/home') }, 'Home'),
        h('button.btn', { onclick: () => go('#/notebook') }, 'Mistake Notebook'),
        h('button.btn.primary', { onclick: () => { location.hash = '#/practice'; } }, 'More practice'))));
  };

  const run = (items, resume) => {
    const stage = h('div');
    main.replaceChildren(stage);
    stop = runSequence(stage, items, { title: 'Today', ctx: { session: 'today' }, resumeKey: KEY, resume, onFinish: finished });
  };

  // a session stopped earlier today: continue it, or start a fresh one
  const place = savedPlace(KEY);
  if (place) {
    const left = place.queue.filter((x) => x.type !== 'intro').length;
    main.append(h('div.card.center',
      h('h1', 'Today’s session'),
      h('p', `You stopped half-way: ${left} question${left === 1 ? '' : 's'} left.`),
      h('div.row', { style: 'justify-content:center' },
        h('button.btn.primary.big', { onclick: () => { prefetchAudio(audioOf(place.queue)); run(place.queue, place); }, autofocus: true },
          'Continue where I left off'),
        h('button.btn', { onclick: () => { forgetPlace(KEY); main.replaceChildren(); fresh(); } }, 'Start a new session'))));
    return () => { if (stop) stop(); };
  }
  await fresh();
  return () => { document.removeEventListener('keydown', onKey); if (stop) stop(); };

  function onKey(e) { if (e.key === 'Enter' && !stop) { e.preventDefault(); document.removeEventListener('keydown', onKey); begin(); } }
  async function fresh() {
    main.append(h('p.muted.boot-status', 'Building today’s session…'));
    const s = await api('session/today', {});
    if (!s.items.length) {
      main.replaceChildren(h('div.card.center', h('h2', 'Nothing to practise yet'),
        h('p.muted', 'Start with a chapter and the reviews will build up from there.'),
        h('button.btn.primary', { onclick: () => go('#/learn') }, 'Go to the chapters')));
      return;
    }
    prefetchAudio(audioOf(s.items));               // the session keeps its sound without internet
    const sm = s.summary;
    begin = () => { document.removeEventListener('keydown', onKey); run(s.items, null); };
    main.replaceChildren(h('div.card.center',
      h('h1', 'Today’s session'),
      h('p.muted', `About ${s.minutes} minutes · ${s.items.filter((x) => x.type !== 'intro').length} questions`),
      sm.catching_up ? h('div.tip.small', { style: 'text-align:left' }, h('b', 'You’re catching up. '),
        `${sm.due_total} reviews were waiting, so today is mostly reviews and fewer new words. `
        + 'A few sessions like this and you are back on track — nothing is lost.') : null,
      h('div.grid.session-mix', { style: 'max-width:640px;margin:12px auto' },
        sm.chapter ? h('div.stat', h('div.n', String(sm.chapter)), h('div.l', 'from your chapter')) : null,
        h('div.stat', h('div.n', String(sm.mistakes)), h('div.l', 'mistakes to fix')),
        h('div.stat', h('div.n', String(sm.reviews)), h('div.l', 'reviews due')),
        h('div.stat', h('div.n', String(sm.new_words)), h('div.l', 'new words')),
        sm.listening ? h('div.stat', h('div.n', String(sm.listening)), h('div.l', 'listening')) : null,
        h('div.stat', h('div.n', String(sm.drills)), h('div.l', 'drills'))),
      h('button.btn.primary.big', { onclick: begin, autofocus: true }, 'Start'),
      h('p.small.muted.kbd-hint', { style: 'margin-top:10px' }, 'Enter submits · Enter again continues · number keys pick answers')));
    document.addEventListener('keydown', onKey);
  }
}
