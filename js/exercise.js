// Exercise runner: renders any exercise type, sends the answer to /api/grade, shows the feedback
// (what you wrote vs the answer, diagnosis, conjugation table, why, extra example, "I was right", "Report").
// Keyboard: Enter submits · Enter again continues · number keys pick a choice.
import { api, h, md, accentMarked, playAudio, playBtn, conjTable, whyText, regTag, settings, exampleRow, toast,
  clipReady, localDay } from './ui.js';
import { answerBox } from './input.js';
import { focusMode, store } from './app.js';

const CHOICE = ['mc', 'listen_mc', 'dialogue_q'];
const LISTEN = ['listen_mc', 'listen_type'];
const TYPED = ['type', 'fill', 'en2es', 'es2en', 'listen_type', 'order', 'reply', 'conj'];

// A new word is shown (with audio and an example) before it is ever tested — and so is a new verb's table.
function renderIntro(root, ex, onDone) {
  const it = ex.item;
  const go = () => { document.removeEventListener('keydown', onKey); onDone && onDone({ intro: true, correct: true }); };
  const onKey = (e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); go(); } };
  document.addEventListener('keydown', onKey);
  if (ex.kind === 'verb') {
    root.replaceChildren(h('div.card.exercise',
      h('div.prompt', '✨ ' + ex.title),
      h('div.en-line', ex.inf + ' = ' + (ex.en || '')),
      h('p.small.muted', 'Have a look at the whole table first — the questions about it come next.'),
      ex.table ? conjTable(ex.table) : null,
      h('div.row', { style: 'margin-top:12px' }, h('button.btn.primary.continue', { type: 'button', onclick: go }, 'Got it'),
        h('span.small.muted.kbd-hint', 'or press Enter'))));
    return () => document.removeEventListener('keydown', onKey);
  }
  root.replaceChildren(h('div.card.exercise',
    h('div.row.between', h('div.prompt', '✨ New word'), regTag(it.reg)),
    h('div.row', { style: 'margin:10px 0' }, h('div.es-big', { html: accentMarked(it.es) }), playBtn(it.audio)),
    h('div.en-line', { style: 'font-size:1.15rem' }, it.en),
    it.note ? h('div.tip.small', it.note) : null,
    it.ex ? h('div.card.flat', exampleRow({ es: it.ex, en: it.ex_en, audio: it.ex_audio })) : null,
    h('div.row', { style: 'margin-top:12px' }, h('button.btn.primary.continue', { type: 'button', onclick: go }, 'Got it'),
      h('span.small.muted.kbd-hint', 'or press Enter — you will be asked about it in a minute'))));
  if (settings.autoplay && it.audio) setTimeout(() => playAudio(it.audio), 250);
  return () => document.removeEventListener('keydown', onKey);
}

export function renderExercise(root, ex, { onDone, ctx = {}, dry = false } = {}) {
  if (ex.type === 'intro') return renderIntro(root, ex, onDone);
  root.replaceChildren();
  const started = performance.now();
  let answered = false;
  let submitting = false;
  let getAnswer = () => '';
  let focusInput = null;
  const box = h('div.card.exercise');
  const feedback = h('div', { role: 'status', 'aria-live': 'polite' });
  const nudge = h('div.small.muted.nudge', { 'aria-live': 'polite' });
  const submitBtn = h('button.btn.primary', { type: 'button', onclick: () => submit() }, 'Check');
  let onSkip = () => submit('');
  const skipBtn = h('button.btn.ghost', { type: 'button', title: 'Show me the answer', onclick: () => onSkip() }, "I don't know");
  const actions = h('div.row', { style: 'margin-top:14px' }, submitBtn, skipBtn);

  // ---------- header / prompt
  if (ex.reg && ex.reg !== 'neutral') box.append(h('div', { style: 'float:right' }, regTag(ex.reg)));
  box.append(h('div.prompt', ex.prompt || ''));
  if (ex.routed) box.append(h('div.small.muted', ex.route_note));

  if (ex.type === 'conj' || ex.original_type === 'conj') {
    box.append(h('div', { style: 'margin:10px 0' },
      h('span.es-big', ex.inf), h('span.en', '  ' + (ex.inf_en || ''))),
    h('div.row', h('span.tag.level', ex.tense_label || ''), ex.person_label ? h('span.tag.informal', ex.person_label) : null,
      ex.gloss ? h('span.en', '“' + ex.gloss + '”') : null));
  } else if (LISTEN.includes(ex.type)) {
    const big = h('button.btn.big', { type: 'button', onclick: () => playAudio(ex.audio) }, '🔊  Play');
    const slow = h('button.btn', { type: 'button', onclick: () => playAudio(ex.audio, 0.75) }, '0.75×');
    box.append(h('div.row', { style: 'margin:12px 0' }, big, slow,
      ex.audio ? null : h('span.small.muted', 'No audio clip for this one yet — press “I don’t know” to skip.')));
    if (ex.audio && settings.autoplay) setTimeout(() => playAudio(ex.audio), 250);
  } else if (ex.type === 'reply') {
    // a message to answer, like on WhatsApp: the message (with its sound and English), then your reply
    box.append(h('div.chat',
      h('div.bubble', h('div.row', { style: 'gap:8px;flex-wrap:nowrap;align-items:flex-start' },
        h('div', h('div.es', { html: accentMarked(ex.es || '') }), ex.en ? h('div.en.small', ex.en) : null),
        ex.audio_msg ? playBtn(ex.audio_msg, { slow: false }) : null))));
    if (ex.audio_msg && settings.autoplay) setTimeout(() => playAudio(ex.audio_msg), 250);
  } else {
    // a sentence with a blank plays with a pause where the blank is: the audio must not give the answer away
    if (ex.es) box.append(h('div.row', h('div.sentence', { html: accentMarked(ex.es) }),
      ex.es.includes('___') ? (ex.audio_q ? playBtn(ex.audio_q) : null) : playBtn(ex.audio)));
    if (ex.en && ex.type !== 'es2en') box.append(h('div.en-line', ex.en));
  }
  if (ex.hint) box.append(h('div.hint', '💡 ' + ex.hint));
  // words no lesson has taught yet: shown with their meaning, so nothing is expected that was never learned
  if (ex.word_hints && ex.word_hints.length) {
    box.append(h('div.word-hints', h('span.lbl', 'New words'),
      ex.word_hints.map((w) => h('span.wh', h('span.es', w.es), ' ', h('span.en', '= ' + w.en)))));
  }

  // ---------- answer widgets
  if (CHOICE.includes(ex.type)) {
    let chosen = null;
    const opts = (ex.options || []).map((o, i) => h('button.opt', { type: 'button', onclick: () => { pick(i); submit(); } },
      h('span.k', String(i + 1)), h('span', { html: accentMarked(o) })));
    const pick = (i) => { chosen = i; opts.forEach((b, j) => b.classList.toggle('sel', i === j)); };
    box.append(h('div.opts', { role: 'group', 'aria-label': 'Choices' }, opts));
    getAnswer = () => (chosen === null ? '' : ex.options[chosen]);
    submitBtn.classList.add('hidden');
    box._keys = (e) => {
      const n = parseInt(e.key, 10);
      if (!answered && n >= 1 && n <= opts.length) { e.preventDefault(); pick(n - 1); submit(); }
    };
    box._mark = (expected) => opts.forEach((b, j) => {
      if (ex.options[j] === expected) { b.classList.add('right'); b.setAttribute('aria-label', 'Right answer: ' + ex.options[j]); }
      else if (j === chosen) { b.classList.add('wrong'); b.setAttribute('aria-label', 'Your choice (wrong): ' + ex.options[j]); }
      b.disabled = true;
    });
  } else if (ex.type === 'order') {
    const picked = [];
    const target = h('div.chips.target', { 'aria-label': 'Your sentence' });
    const pool = h('div.chips');
    const chips = ex.chips.map((w, i) => h('button.chip', { type: 'button', onclick: () => add(i) }, w));
    const redraw = () => {
      target.replaceChildren(...picked.map((i, k) => h('button.chip', { type: 'button', onclick: () => { picked.splice(k, 1); redraw(); } }, ex.chips[i])));
      chips.forEach((c, i) => c.classList.toggle('used', picked.includes(i)));
    };
    const add = (i) => { if (!picked.includes(i) && !answered) { picked.push(i); redraw(); } };
    pool.append(...chips);
    box.append(target, pool, h('div.small.muted', 'Tap the words in order. Tap a word in the box to take it back.'));
    getAnswer = () => picked.map((i) => ex.chips[i]).join(' ');
    box._keys = (e) => {
      if (answered) return;
      if (e.key === 'Backspace') { picked.pop(); redraw(); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= chips.length) { const free = chips.map((_, i) => i).filter((i) => !picked.includes(i)); if (free[n - 1] !== undefined) add(free[n - 1]); }
    };
  } else if (ex.type === 'match') {
    const wrong = []; let left = null; let done = 0;
    const L = ex.pairs.map(([es]) => h('button.opt', { type: 'button' }, h('span.es', { html: accentMarked(es) })));
    const R = ex.right.map((en) => h('button.opt', { type: 'button' }, en));
    L.forEach((b, i) => b.addEventListener('click', () => { left = i; L.forEach((x, j) => x.classList.toggle('sel', i === j)); playAudio(ex.pair_audio[ex.pairs[i][0]]); }));
    R.forEach((b, j) => b.addEventListener('click', () => {
      if (left === null) return;
      if (ex.pairs[left][1] === ex.right[j]) {
        L[left].classList.add('done'); b.classList.add('done'); L[left].classList.remove('sel'); left = null; done += 1;
        if (done === ex.pairs.length) submit({ wrong });
      } else {
        b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 500);
        if (!wrong.includes(ex.pairs[left][0])) wrong.push(ex.pairs[left][0]);
      }
    }));
    const grid = h('div.match');
    ex.pairs.forEach((_, i) => grid.append(L[i], R[i]));
    box.append(grid);
    submitBtn.classList.add('hidden');
    // stuck? "I don't know" shows every pair (the ones not matched yet count as mixed up)
    onSkip = () => {
      const left2 = ex.pairs.filter((_, i) => !L[i].classList.contains('done')).map((p) => p[0]);
      L.forEach((b) => b.classList.add('done')); R.forEach((b) => b.classList.add('done'));
      submit({ wrong: [...new Set([...wrong, ...left2])] });
    };
  } else {
    const spanish = ex.type !== 'es2en';
    const { input, bar } = answerBox({ spanish, placeholder: ex.type === 'reply' ? 'Your reply in Spanish…'
      : spanish ? 'Type in Spanish…' : 'Type in English…' });
    box.append(h('div', { style: 'margin-top:12px' }, input, bar));
    getAnswer = () => input.value;
    focusInput = () => input.focus({ preventScroll: true });
    box._lock = () => { input.readOnly = true; };
  }

  box.append(actions, nudge, feedback);
  root.append(box);
  // the keyboard opens straight away: iOS only allows that while the tap that led here is still being handled
  if (focusInput) focusInput();

  // ---------- keyboard
  let answeredAt = 0;
  const onKey = (e) => {
    if (e.key === 'Enter') {
      if (e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if (e.repeat) return;                       // holding Enter must not skip the feedback
      if (answered) { if (performance.now() - answeredAt > 350) finish(); } else if (ex.type !== 'match') submit();
      return;
    }
    if (box._keys && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) box._keys(e);
  };
  document.addEventListener('keydown', onKey);
  let lastResult = null;
  let finished = false;
  function finish() {
    if (finished || performance.now() - answeredAt < 400) return;   // a quick double tap must not answer the next one
    finished = true;
    document.removeEventListener('keydown', onKey);
    if (onDone) onDone(lastResult);
  }

  async function submit(forced) {
    if (answered || submitting) return;
    const answer = forced !== undefined ? forced : getAnswer();
    if (forced === undefined && typeof answer === 'string' && !answer.trim() && !CHOICE.includes(ex.type)) {
      nudge.textContent = ex.type === 'order' ? 'Tap the words first — or press “I don’t know”.'
        : 'Type your answer first — or press “I don’t know”.';
      return;
    }
    nudge.textContent = '';
    submitting = true;
    let r;
    try {
      r = await api('grade', { ex, answer, seconds: (performance.now() - started) / 1000, ctx, dry });
    } catch (err) {
      submitting = false;
      feedback.replaceChildren(h('div.feedback.bad', 'Could not check the answer: ' + err.message));
      return;
    }
    answered = true; lastResult = r; answeredAt = performance.now();
    if (box._mark) box._mark(r.expected);
    if (box._lock) box._lock();
    actions.replaceChildren();
    feedback.replaceChildren(feedbackPanel(ex, r, finish, { dry, typed: typeof answer === 'string' ? answer : '' }));
    if (settings.autoplay && r.audio && !(LISTEN.includes(ex.type) && r.correct)) playAudio(r.audio);
    const cont = feedback.querySelector('.continue');
    if (cont) cont.focus({ preventScroll: true });
    feedback.scrollIntoView({ block: feedback.offsetHeight > window.innerHeight * 0.75 ? 'start' : 'nearest', behavior: 'smooth' });
  }

  return () => document.removeEventListener('keydown', onKey);
}

export function feedbackPanel(ex, r, onContinue, { dry = false, typed = '' } = {}) {
  const cls = r.verdict === 'correct' ? 'good' : r.verdict === 'almost' ? 'almost' : 'bad';
  const title = r.verdict === 'correct' ? pick(['✓ Correct!', '✓ ¡Bien!', '✓ ¡Eso!', '✓ ¡Perfecto!', '✓ ¡Muy bien, che!'])
    : r.verdict === 'almost' ? '≈ Almost' : '✗ Not quite — let’s look at it';
  const panel = h('div.feedback.' + cls, h('h3', title));
  const showSentence = r.sentence && r.sentence !== r.expected;

  if (r.verdict === 'wrong' && ex.type !== 'match') {
    panel.append(h('div.versus',
      h('div.yours', h('div.lbl', CHOICE.includes(ex.type) ? 'You chose' : 'You wrote'), h('div.val', r.typed || '—')),
      h('div.correct', h('div.lbl', 'Correct answer'), h('div.row', h('div.val', { html: accentMarked(r.expected) }), playBtn(r.audio)))));
  } else {
    panel.append(h('div.row', h('div.es-big', { html: accentMarked(r.expected) }), playBtn(r.audio)));
  }
  if (showSentence) panel.append(h('div', h('span.es', { html: accentMarked(r.sentence) }), r.sentence_en && ex.type !== 'reply' ? h('span.en', '  — ' + r.sentence_en) : null));
  else if (r.sentence_en && !['en2es', 'reply'].includes(ex.type)) panel.append(h('div.en-line', r.sentence_en));
  if (r.accent_note) panel.append(h('div.note-accent', { html: 'ℹ️ ' + accentMarked(r.accent_note) + ' <span class="muted">(not an error — just so you know how it is written)</span>' }));
  (r.notes || []).forEach((n) => panel.append(h('div.note-accent', { html: md(n) })));

  if (r.diagnosis && r.diagnosis.length) {
    panel.append(h('div.diag', h('b', 'What happened'), h('ul', r.diagnosis.map((m) => h('li', { html: md(m).replace(/^<p>|<\/p>$/g, '') })))));
  }
  (r.pair_notes || []).forEach((n) => panel.append(h('div.small', { html: md(n) })));
  if (r.table && r.verdict !== 'correct') panel.append(conjTable(r.table));
  if (r.why && r.verdict !== 'correct') panel.append(h('div.why', { html: '<b>Why:</b> ' + md(whyText(r.why, r.table)).replace(/^<p>|<\/p>$/g, '') }));
  if (r.why && r.verdict === 'correct' && ex.show_why) panel.append(h('div.why.small', { html: md(r.why) }));
  if (r.extra && r.verdict !== 'correct') panel.append(h('div', h('div.small.muted', 'One more example of the same thing:'), exampleRow(r.extra)));
  if (ex.note && r.verdict === 'correct') panel.append(h('div.small.muted', ex.note));
  const saved = h('div.small.muted', { style: 'margin-top:8px' }, '📓 Saved to your Mistake Notebook — it will come back for review soon.');
  if (r.verdict === 'wrong' && !dry && ex.type !== 'dialogue_q') panel.append(saved);

  // "I was right": a typed answer marked wrong that is actually fine — undo the penalty, accept it from now on
  const extras = h('div.row.fb-extras');
  if (r.verdict === 'wrong' && !dry && r.answer_id && TYPED.includes(ex.type) && (typed || '').trim()) {
    extras.append(h('button.btn.small', { type: 'button', onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        await api('grade/override', { answer_id: r.answer_id });
        r.correct = true; r.verdict = 'correct';
        panel.classList.remove('bad'); panel.classList.add('good');
        panel.querySelector('h3').textContent = '✓ Counted as right';
        saved.remove();
        b.replaceWith(h('span.small.muted', 'Counted as right — this answer is accepted from now on. '
          + 'If the app was wrong here, “Report” tells Claude.'));
      } catch (err) { b.disabled = false; toast(err.message, 4000); }
    } }, '✋ I was right'));
  }
  extras.append(reportButton(ex, r, typed));
  panel.append(extras);
  panel.append(h('div.row', { style: 'margin-top:12px' },
    h('button.btn.primary.continue', { type: 'button', onclick: onContinue }, 'Continue'), h('span.small.muted.kbd-hint', 'or press Enter')));
  return panel;
}

// "Report a problem": a wrong answer key, odd Spanish, a bad translation… kept in Settings → Reported problems.
function reportButton(ex, r, typed) {
  const wrap = h('span');
  const btn = h('button.btn.small.ghost', { type: 'button', onclick: () => {
    const note = h('input.search', { type: 'text', placeholder: 'What is wrong? (optional)', style: 'flex:1;min-width:0' });
    const send = h('button.btn.small', { type: 'button', onclick: async () => {
      send.disabled = true;
      try {
        await api('report', { ex, typed, expected: r.expected, note: note.value });
        wrap.replaceChildren(h('span.small.muted', '🚩 Reported — find it in Settings → Reported problems.'));
      } catch (err) { send.disabled = false; toast(err.message, 4000); }
    } }, 'Send');
    note.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); send.click(); } });
    wrap.replaceChildren(h('div.row', { style: 'width:100%;flex-wrap:nowrap' }, note, send));
    note.focus();
  } }, '🚩 Report a problem');
  wrap.append(btn);
  return wrap;
}

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

// Runs a list of exercises one after another with a progress bar; wrong ones come back once at the end.
// resumeKey: keep the place in this browser, so a stopped session / lesson can be continued later the same day.
// Listening questions whose sound is not on the phone and cannot be downloaded (no connection) are skipped.
export function runSequence(root, exercises, { ctx = {}, onFinish, onAnswer, title = '', dry = false, retry = true,
  resumeKey = null, resume = null } = {}) {
  const queue = resume ? resume.queue.slice() : exercises.slice();
  let total = resume ? resume.total : exercises.filter((x) => x.type !== 'intro').length;
  let doneCount = resume ? resume.doneCount : 0;
  let right = resume ? resume.right : 0;
  let firstTry = resume ? resume.firstTry : 0;
  const retried = new Set(resume ? resume.retried : []);
  let cleanup = null;
  let current = null;
  let closed = false;
  const bar = h('i', { style: 'width:0%' });
  const counter = h('span.small.muted', '');
  const save = () => {
    if (!resumeKey) return;
    const left = (current ? [current] : []).concat(queue);
    if (!left.some((x) => x.type !== 'intro')) { store.set(resumeKey, ''); return; }
    store.set(resumeKey, JSON.stringify({ date: localDay(), title, queue: left, total, doneCount, right, firstTry,
      retried: [...retried] }));
  };
  const stop = () => {
    if (closed) return;
    if (doneCount > 0 && current && !confirm(resumeKey ? 'Stop here? You can continue later today from where you left off.'
      : 'Stop here? Your answers so far are saved.')) return;
    closed = true;
    if (cleanup) cleanup();
    focusMode(false);
    save();
    onFinish && onFinish({ total, right: firstTry, aborted: true });
  };
  const top = h('div.topbar', title ? h('b.seq-title', title) : null,
    h('div.bar', { role: 'progressbar', 'aria-label': 'Progress' }, bar), counter,
    h('button.btn.ghost', { type: 'button', 'aria-label': 'Stop', onclick: stop }, '✕'));
  const stage = h('div');
  root.replaceChildren(top, stage);
  focusMode(true);

  const next = async () => {
    if (closed) return;
    if (cleanup) cleanup();
    let ex = queue.shift();
    // no sound for a listening question (offline, not saved on the phone): skip it, it does not count
    while (ex && LISTEN.includes(ex.type) && ex.audio && !(await clipReady(ex.audio))) {
      toast('🔇 A listening question was skipped — its sound needs an internet connection.', 3500);
      if (!retried.has(ex.id)) total -= 1;
      ex = queue.shift();
    }
    current = ex || null;
    bar.style.width = (100 * doneCount / Math.max(1, total)) + '%';
    counter.textContent = `${Math.min(doneCount + 1, total)} / ${total}`;
    save();
    if (!ex) {
      closed = true; focusMode(false);
      if (resumeKey) store.set(resumeKey, '');
      onFinish && onFinish({ total, right: firstTry, aborted: false });
      return;
    }
    cleanup = renderExercise(stage, ex, { ctx, dry, onDone: (r) => {
      if (r && r.intro) { current = null; next(); return; }
      if (onAnswer) onAnswer(ex, r);
      const again = retried.has(ex.id);
      if (r && r.correct) { right += 1; if (!again) firstTry += 1; }
      if (retry && r && !r.correct && !again && ex.type !== 'match') { retried.add(ex.id); queue.push(ex); } else { doneCount += 1; }
      current = null;
      next();
    } });
  };
  next();
  return () => { closed = true; if (cleanup) cleanup(); focusMode(false); };
}

// A saved place in a sequence (runSequence resumeKey), if it is from today.
export function savedPlace(key) {
  try {
    const r = JSON.parse(store.get(key) || 'null');
    return r && r.date === localDay() && r.queue && r.queue.some((x) => x.type !== 'intro') ? r : null;
  } catch { return null; }
}
export function forgetPlace(key) { store.set(key, ''); }
