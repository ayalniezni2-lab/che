// Typing helpers: clickable á é í ó ú ñ ¿ ¡ and optional shortcuts (a' → á, n~ → ñ, ?? → ¿, !! → ¡).
// Plain letters are always accepted by the grader — these are conveniences, never requirements.
import { h, settings } from './ui.js';

const ACUTE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú' };

export function applyShortcuts(input) {
  const pos = input.selectionStart;
  if (pos === null || pos !== input.selectionEnd) return;
  const v = input.value;
  const before = v.slice(0, pos);
  let rep = null; let cut = 2;
  const two = before.slice(-2);
  if (two.length === 2 && two[1] === "'" && ACUTE[two[0]]) rep = ACUTE[two[0]];
  else if (two === 'n~') rep = 'ñ';
  else if (two === 'N~') rep = 'Ñ';
  else if (two === '??' && /(^|\s)$/.test(before.slice(0, -2))) rep = '¿';
  else if (two === '!!' && /(^|\s)$/.test(before.slice(0, -2))) rep = '¡';
  else if (two === 'u:' ) { rep = 'ü'; }
  if (!rep) return;
  input.value = before.slice(0, -cut) + rep + v.slice(pos);
  const np = pos - cut + rep.length;
  input.setSelectionRange(np, np);
}

export function insertAtCaret(input, ch) {
  const s = input.selectionStart ?? input.value.length;
  const e = input.selectionEnd ?? s;
  input.value = input.value.slice(0, s) + ch + input.value.slice(e);
  input.focus();
  input.setSelectionRange(s + ch.length, s + ch.length);
}

// Text box + accent bar.  spanish=false turns the helpers off (for answers typed in English).
export function answerBox({ placeholder = 'Type your answer…', spanish = true, inline = false } = {}) {
  const input = h('input.answer-input' + (inline ? '.inline' : ''), {
    type: 'text', placeholder, autocomplete: 'off', autocapitalize: 'off', spellcheck: false,
    lang: spanish ? 'es' : 'en' });
  input.setAttribute('autocorrect', 'off');
  if (spanish) input.addEventListener('input', () => { if (settings.shortcuts) applyShortcuts(input); });
  let bar = null;
  if (spanish) {
    bar = h('div.accent-bar', { 'aria-label': 'Accent helpers (optional)' },
      ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡'].map((ch) =>
        h('button', { type: 'button', tabIndex: -1, title: 'Insert ' + ch,
          onmousedown: (e) => e.preventDefault(), onclick: () => insertAtCaret(input, ch) }, ch)),
      h('span.legend', { html: settings.shortcuts
        ? "Optional — plain letters are fine. Shortcuts: <kbd>a'</kbd>→á &nbsp;<kbd>n~</kbd>→ñ &nbsp;<kbd>??</kbd>→¿ &nbsp;<kbd>!!</kbd>→¡"
        : 'Optional — plain letters are always accepted.' }));
  }
  return { input, bar };
}
