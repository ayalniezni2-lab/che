// Exercise runner: renders any exercise type, sends the answer to /api/grade, shows the feedback
// (what you wrote vs the answer, diagnosis, conjugation table, why, extra example).
// Keyboard: Enter submits · Enter again continues · number keys pick a choice.
import { api, h, md, accentMarked, playAudio, playBtn, conjTable, regTag, settings, exampleRow, esc } from './ui.js';
import { answerBox } from './input.js';

const CHOICE = ['mc', 'listen_mc', 'dialogue_q'];
const LISTEN = ['listen_mc', 'listen_type'];

// A new word is shown (with audio and an example) before it is ever tested.
function renderIntro(root, ex, onDone) {
  const it = ex.item;
  const go = () => { document.removeEventListener('keydown', onKey); onDone && onDone({ intro: true, correct: true }); };
  const onKey = (e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); go(); } };
  document.addEventListener('keydown', onKey);
  root.replaceChildren(h('div.card.exercise',
    h('div.row.between', h('div.prompt', '✨ New word'), regTag(it.reg)),
    h('div.row', { style: 'margin:10px 0' }, h('div.es-big', { html: accentMarked(it.es) }), playBtn(it.audio)),
    h('div', { style: 'font-size:1.15rem' }, it.en),
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
  const box = h('div.card.exercise');
  const feedback = h('div');
  const submitBtn = h('button.btn.primary', { type: 'button', onclick: () => submit() }, 'Check');
  const skipBtn = h('button.btn.ghost', { type: 'button', title: "Show me the answer", onclick: () => submit('') }, "I don't know");
  const actions = h('div.row', { style: 'margin-top:14px' }, submitBtn, skipBtn);

  // ---------- header / prompt
  if (ex.reg && ex.reg !== 'neutral') box.append(h('div', { style: 'float:right' }, regTag(ex.reg)));
  box.append(h('div.prompt', ex.prompt || ''));
  if (ex.routed) box.append(h('div.small.muted', ex.route_note));

  if (ex.type === 'conj' || ex.original_type === 'conj') {
    box.append(h('div', { style: 'margin:10px 0' },
      h('span.es-big', ex.inf), h('span.en', '  ' + (ex.inf_en || ''))),
    h('div.row', h('span.tag.level', ex.tense_label || ''), ex.person_label ? h('span.tag.informal', ex.person_label) : null,
      ex.gloss ? h('span.muted', '“' + ex.gloss + '”') : null));
  } else if (LISTEN.includes(ex.type)) {
    const big = h('button.btn.big', { type: 'button', onclick: () => playAudio(ex.audio) }, '🔊  Play');
    const slow = h('button.btn', { type: 'button', onclick: () => playAudio(ex.audio, 0.75) }, '0.75×');
    box.append(h('div.row', { style: 'margin:12px 0' }, big, slow,
      ex.audio ? null : h('span.small.muted', 'No audio clip for this one yet — press “I don’t know” to skip.')));
    if (ex.audio && settings.autoplay) setTimeout(() => playAudio(ex.audio), 250);
  } else {
    if (ex.es) box.append(h('div.row', h('div.sentence', { html: accentMarked(ex.es) }),
      ex.type === 'fill' || ex.original_type === 'fill' ? null : playBtn(ex.audio)));
    if (ex.en && ex.type !== 'es2en') box.append(h('div.hint', ex.en));
  }
  if (ex.hint) box.append(h('div.hint', '💡 ' + ex.hint));

  // ---------- answer widgets
  if (CHOICE.includes(ex.type)) {
    let chosen = null;
    const opts = (ex.options || []).map((o, i) => h('button.opt', { type: 'button', onclick: () => { pick(i); submit(); } },
      h('span.k', String(i + 1)), h('span', { html: accentMarked(o) })));
    const pick = (i) => { chosen = i; opts.forEach((b, j) => b.classList.toggle('sel', i === j)); };
    box.append(h('div.opts', opts));
    getAnswer = () => (chosen === null ? '' : ex.options[chosen]);
    submitBtn.classList.add('hidden');
    box._keys = (e) => {
      const n = parseInt(e.key, 10);
      if (!answered && n >= 1 && n <= opts.length) { e.preventDefault(); pick(n - 1); submit(); }
    };
    box._mark = (expected) => opts.forEach((b, j) => {
      if (ex.options[j] === expected) b.classList.add('right');
      else if (j === chosen) b.classList.add('wrong');
      b.disabled = true;
    });
  } else if (ex.type === 'order') {
    const picked = [];
    const target = h('div.chips.target');
    const pool = h('div.chips');
    const chips = ex.chips.map((w, i) => h('button.chip', { type: 'button', onclick: () => add(i) }, w));
    const redraw = () => {
      target.replaceChildren(...picked.map((i, k) => h('button.chip', { type: 'button', onclick: () => { picked.splice(k, 1); redraw(); } }, ex.chips[i])));
      chips.forEach((c, i) => c.classList.toggle('used', picked.includes(i)));
    };
    const add = (i) => { if (!picked.includes(i) && !answered) { picked.push(i); redraw(); } };
    pool.append(...chips);
    box.append(target, pool, h('div.small.muted', 'Click the words in order. Click a word in the box to take it back. Backspace removes the last one.'));
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
    submitBtn.classList.add('hidden'); skipBtn.classList.add('hidden');
  } else {
    const spanish = ex.type !== 'es2en';
    const { input, bar } = answerBox({ spanish, placeholder: spanish ? 'Type in Spanish…' : 'Type in English…' });
    box.append(h('div', { style: 'margin-top:12px' }, input, bar));
    getAnswer = () => input.value;
    setTimeout(() => input.focus(), 30);
    box._lock = () => { input.readOnly = true; };
  }

  box.append(actions, feedback);
  root.append(box);

  // ---------- keyboard
  let answeredAt = 0;
  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;                       // holding Enter must not skip the feedback
      if (answered) { if (performance.now() - answeredAt > 350) finish(); } else if (ex.type !== 'match') submit();
      return;
    }
    if (box._keys && !(e.target instanceof HTMLInputElement)) box._keys(e);
  };
  document.addEventListener('keydown', onKey);
  let lastResult = null;
  function finish() {
    document.removeEventListener('keydown', onKey);
    if (onDone) onDone(lastResult);
  }

  async function submit(forced) {
    if (answered || submitting) return;
    const answer = forced !== undefined ? forced : getAnswer();
    if (forced === undefined && typeof answer === 'string' && !answer.trim() && !CHOICE.includes(ex.type)) return;
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
    feedback.replaceChildren(feedbackPanel(ex, r, finish));
    if (settings.autoplay && r.audio && !(LISTEN.includes(ex.type) && r.correct)) playAudio(r.audio);
    const cont = feedback.querySelector('.continue');
    if (cont) cont.focus({ preventScroll: true });
    feedback.scrollIntoView({ block: feedback.offsetHeight > window.innerHeight * 0.75 ? 'start' : 'nearest', behavior: 'smooth' });
  }

  return () => document.removeEventListener('keydown', onKey);
}

export function feedbackPanel(ex, r, onContinue) {
  const cls = r.verdict === 'correct' ? 'good' : r.verdict === 'almost' ? 'almost' : 'bad';
  const title = r.verdict === 'correct' ? pick(['✓ Correct!', '✓ ¡Bien!', '✓ ¡Eso!', '✓ ¡Perfecto!', '✓ ¡Muy bien, che!'])
    : r.verdict === 'almost' ? '≈ Almost' : '✗ Not quite — let’s look at it';
  const panel = h('div.feedback.' + cls, h('h3', title));
  const showSentence = r.sentence && r.sentence !== r.expected;

  if (r.verdict === 'wrong' && ex.type !== 'match') {
    panel.append(h('div.versus',
      h('div.yours', h('div.lbl', 'You wrote'), h('div.val', r.typed || '—')),
      h('div.correct', h('div.lbl', 'Correct answer'), h('div.row', h('div.val', { html: accentMarked(r.expected) }), playBtn(r.audio)))));
  } else {
    panel.append(h('div.row', h('div.es-big', { html: accentMarked(r.expected) }), playBtn(r.audio)));
  }
  if (showSentence) panel.append(h('div', h('span.es', { html: accentMarked(r.sentence) }), r.sentence_en ? h('span.en', '  — ' + r.sentence_en) : null));
  else if (r.sentence_en && ex.type !== 'en2es') panel.append(h('div.en', r.sentence_en));
  if (r.accent_note) panel.append(h('div.note-accent', { html: 'ℹ️ ' + accentMarked(r.accent_note) + ' <span class="muted">(not an error — just so you know how it is written)</span>' }));
  (r.notes || []).forEach((n) => panel.append(h('div.note-accent', { html: md(n) })));

  if (r.diagnosis && r.diagnosis.length) {
    panel.append(h('div.diag', h('b', 'What happened'), h('ul', r.diagnosis.map((m) => h('li', { html: md(m).replace(/^<p>|<\/p>$/g, '') })))));
  }
  (r.pair_notes || []).forEach((n) => panel.append(h('div.small', { html: md(n) })));
  if (r.table && r.verdict !== 'correct') panel.append(conjTable(r.table));
  if (r.why && r.verdict !== 'correct') panel.append(h('div.why', { html: '<b>Why:</b> ' + md(r.why).replace(/^<p>|<\/p>$/g, '') }));
  if (r.why && r.verdict === 'correct' && ex.show_why) panel.append(h('div.why.small', { html: md(r.why) }));
  if (r.extra && r.verdict !== 'correct') panel.append(h('div', h('div.small.muted', 'One more example of the same thing:'), exampleRow(r.extra)));
  if (ex.note && r.verdict === 'correct') panel.append(h('div.small.muted', ex.note));
  if (r.verdict === 'wrong') panel.append(h('div.small.muted', { style: 'margin-top:8px' }, '📓 Saved to your Mistake Notebook — it will come back for review soon.'));
  panel.append(h('div.row', { style: 'margin-top:12px' },
    h('button.btn.primary.continue', { type: 'button', onclick: onContinue }, 'Continue'), h('span.small.muted.kbd-hint', 'or press Enter')));
  return panel;
}

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

// Runs a list of exercises one after another with a progress bar; wrong ones come back once at the end.
export function runSequence(root, exercises, { ctx = {}, onFinish, onAnswer, title = '', dry = false, retry = true } = {}) {
  const queue = exercises.slice();
  const total = exercises.filter((x) => x.type !== 'intro').length;
  let doneCount = 0; let right = 0; let firstTry = 0;
  const retried = new Set();
  let cleanup = null;
  const bar = h('i', { style: 'width:0%' });
  const counter = h('span.small.muted', '');
  const top = h('div.topbar', title ? h('b', title) : null, h('div.bar', bar), counter,
    h('button.btn.ghost', { type: 'button', onclick: () => { if (cleanup) cleanup(); onFinish && onFinish({ total, right: firstTry, aborted: true }); } }, '✕'));
  const stage = h('div');
  root.replaceChildren(top, stage);

  const next = () => {
    if (cleanup) cleanup();
    bar.style.width = (100 * doneCount / Math.max(1, total)) + '%';
    counter.textContent = `${Math.min(doneCount + 1, total)} / ${total}`;
    const ex = queue.shift();
    if (!ex) { onFinish && onFinish({ total, right: firstTry, aborted: false }); return; }
    cleanup = renderExercise(stage, ex, { ctx, dry, onDone: (r) => {
      if (r && r.intro) { next(); return; }
      if (onAnswer) onAnswer(ex, r);
      const again = retried.has(ex.id);
      if (r && r.correct) { right += 1; if (!again) firstTry += 1; }
      if (retry && r && !r.correct && !again && ex.type !== 'match') { retried.add(ex.id); queue.push(ex); } else { doneCount += 1; }
      next();
    } });
  };
  next();
  return () => { if (cleanup) cleanup(); };
}
