// Small DOM + audio helpers shared by every view.  No framework.
import { isStatic, call } from './backend.js';

export async function api(path, body) {
  if (isStatic) {                     // phone / web version: the engine runs in this page (backend.js)
    const [route, qs] = path.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    const out = await call(body === undefined ? 'GET' : 'POST', route, query, body || {});
    if (out.download) return out.download;
    if (out.code >= 400) throw new Error((out.payload && out.payload.error) || ('Request failed: ' + out.code));
    return out.payload;
  }
  const opt = body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const res = await fetch('/api/' + path, opt);
  const data = await res.json().catch(() => ({ error: 'Bad response from the server.' }));
  if (!res.ok) throw new Error(data.error || ('Request failed: ' + res.status));
  return data;
}

// h('div.card', {onclick}, child, child…)
export function h(sel, attrs, ...kids) {
  const [tagId, ...classes] = sel.split('.');
  const [tag, id] = tagId.split('#');
  const el = document.createElement(tag || 'div');
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (attrs instanceof Node || typeof attrs !== 'object' || Array.isArray(attrs))) {
    kids.unshift(attrs); attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v);
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) return c.forEach(add);
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Mark accented letters / ñ / ¿ ¡ so the learner sees the real spelling.
export function accentMarked(text) {
  return esc(text).replace(/[áéíóúüñÁÉÍÓÚÜÑ¿¡]/g, (c) => `<mark class="acc">${c}</mark>`);
}

// Tiny markdown: **bold**, _italic_, `spanish`, lists (- ), blank line = paragraph.
export function md(text) {
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
  const out = [];
  let list = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*[-•]\s+/.test(line)) {
      if (!list) { list = []; out.push(list); }
      list.push(inline(line.replace(/^\s*[-•]\s+/, '')));
    } else {
      list = null;
      if (line.trim() === '') out.push('');
      else if (typeof out[out.length - 1] === 'string' && out[out.length - 1] !== '') out[out.length - 1] += ' ' + inline(line);
      else out.push(inline(line));
    }
  }
  return out.map((b) => Array.isArray(b) ? '<ul>' + b.map((i) => `<li>${i}</li>`).join('') + '</ul>'
    : (b ? `<p>${b}</p>` : '')).join('');
}

export function toast(msg, ms = 2600) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div.toast', msg);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

// ---------------------------------------------------------------- audio (pre-generated MP3s only)
let current = null;
export const settings = { audio_rate: 1.0, autoplay: true, shortcuts: true };

export function playAudio(url, rate) {
  if (!url) return Promise.resolve(false);
  if (current) { current.pause(); current = null; }
  document.querySelectorAll('.play.playing').forEach((b) => b.classList.remove('playing'));
  const a = new Audio(isStatic ? url.replace(/^\//, '') : url);   // web version: relative to the site
  a.playbackRate = rate || settings.audio_rate || 1.0;
  a.preservesPitch = true;
  current = a;
  return a.play().then(() => true).catch(() => false);
}

// Play button (+ optional slow 0.75× button).  Disabled when there is no clip.
export function playBtn(url, { slow = true } = {}) {
  const wrap = h('span.row', { style: 'gap:4px;display:inline-flex;flex-wrap:nowrap' });
  const mk = (label, rate, cls, title) => h('button.play' + cls, {
    type: 'button', title: url ? title : 'No audio for this item yet', disabled: !url,
    onclick: (e) => {
      e.stopPropagation();
      const b = e.currentTarget; b.classList.add('playing');
      playAudio(url, rate).then(() => { if (current) current.onended = () => b.classList.remove('playing'); });
      setTimeout(() => b.classList.remove('playing'), 6000);
    } }, label);
  wrap.append(mk('▶', null, '', 'Play'));
  if (slow) wrap.append(mk('0.75×', 0.75, '.slow', 'Play slowly'));
  return wrap;
}

export function exampleRow(ex) {
  return h('div.example', playBtn(ex.audio),
    h('div.txt', h('div.es', { html: accentMarked(ex.es) }), h('div.en', ex.en || ''),
      ex.note ? h('div.small.muted', ex.note) : null));
}

export function regTag(reg) {
  return h('span.tag.' + (reg || 'neutral'), reg || 'neutral');
}

export const PERSON_LABELS = {
  yo: 'yo', vos: 'vos', el: 'él / ella / usted', nos: 'nosotros', uds: 'ustedes', ellos: 'ellos / ellas' };

// Conjugation table from the server ({title, rows:[{person,label,form,parts,hit,yours}], tip})
export function conjTable(tb) {
  if (!tb) return null;
  const rows = tb.rows.map((r) => {
    const form = h('td.form');
    if (r.parts) form.innerHTML = r.parts.map(([txt, irr]) => irr ? `<span class="irr">${accentMarked(txt)}</span>` : accentMarked(txt)).join('');
    else form.innerHTML = accentMarked(r.form);
    const tr = h('tr' + (r.hit ? '.hit' : '') + (r.yours ? '.yours' : ''),
      h('td.person', r.label), form, h('td', { style: 'width:80px' }, playBtn(r.audio, { slow: false })));
    return tr;
  });
  return h('div', h('div.small.muted', { html: `<b>${esc(tb.title)}</b>` + (tb.subtitle ? ' — ' + esc(tb.subtitle) : '') }),
    h('table.t.conj', h('tbody', rows)),
    tb.tip ? h('div.tip.small', { html: md('💡 ' + tb.tip) }) : null);
}
