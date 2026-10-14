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

// Export the progress file (both versions) and remember the day, for the backup reminder.
// On a phone it opens the share sheet (Save to Files, WhatsApp, Mail…); elsewhere it downloads the file.
// Returns false when the learner cancelled — then it does not count as a backup.
export async function exportProgress() {
  if (!isStatic) {
    const a = h('a', { href: '/api/progress/export', download: '' });
    document.body.append(a); a.click(); a.remove();
    await api('progress/exported', {});
    return true;
  }
  const d = await api('progress/export');
  const file = new File([d.text], d.name, { type: 'application/json' });
  if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Che! progress backup' });
    } catch (err) {
      if (err && err.name === 'AbortError') return false;     // closed the share sheet: nothing was saved
      throw err;
    }
  } else {
    const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: d.name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  await api('progress/exported', {});
  return true;
}

// Today as YYYY-MM-DD in the learner's own time zone (the engine's days are local days too).
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Where a chapter of the course opens: a lesson, or a reading (a text with questions).
export function chapterHref(ch) {
  return (ch.type === 'reading' ? '#/culture/d/' : '#/unit/') + encodeURIComponent(ch.id);
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

// Spanish text for an html: slot. (Accented letters used to be highlighted; the learner asked for plain text.)
export function accentMarked(text) {
  return esc(text);
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
// Phone / web version: every clip that is played or prefetched is kept in the browser's cache ("che-audio"),
// so a session started with internet keeps its sound on the subte. One shared player: once iOS has allowed it to
// play after a tap, later clips may start on their own.
export const settings = { audio_rate: 1.0, autoplay: true, shortcuts: true };
const AUDIO_CACHE = 'che-audio';
const MAX_CLIPS = 4000;                    // ~50 MB; the oldest are dropped first
const player = typeof Audio !== 'undefined' ? new Audio() : null;
const blobs = new Map();                   // url -> object URL of a cached clip
let lastNoAudio = 0;

const clipUrl = (url) => (isStatic ? url.replace(/^\//, '') : url);    // web version: relative to the site
const canCache = () => isStatic && typeof caches !== 'undefined';

async function cachedBlobUrl(url) {
  if (blobs.has(url)) return blobs.get(url);
  if (!canCache()) return null;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    let res = await cache.match(clipUrl(url));
    if (!res) {
      const net = await fetch(clipUrl(url));
      if (!net.ok) return null;
      await cache.put(clipUrl(url), net.clone());
      res = net;
    }
    const obj = URL.createObjectURL(await res.blob());
    blobs.set(url, obj);
    if (blobs.size > 300) {                // keep memory small: forget the oldest object URLs
      const [k, v] = blobs.entries().next().value; URL.revokeObjectURL(v); blobs.delete(k);
    }
    return obj;
  } catch { return null; }
}

// Is this clip playable right now (in the cache, or online)?
export async function clipReady(url) {
  if (!url) return false;
  if (!canCache()) return true;
  if (blobs.has(url)) return true;
  try { if (await (await caches.open(AUDIO_CACHE)).match(clipUrl(url))) return true; } catch { /* no cache */ }
  return navigator.onLine !== false;
}

// Download a session's clips in the background, so it keeps working without internet.
export async function prefetchAudio(urls) {
  if (!canCache() || navigator.onLine === false) return;
  const list = [...new Set(urls.filter(Boolean))];
  let cache;
  try { cache = await caches.open(AUDIO_CACHE); } catch { return; }
  const todo = [];
  for (const u of list) { if (!(await cache.match(clipUrl(u)))) todo.push(u); }
  const worker = async () => {
    while (todo.length) {
      const u = todo.shift();
      try { const r = await fetch(clipUrl(u)); if (r.ok) await cache.put(clipUrl(u), r); } catch { return; }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  try {                                    // keep the cache to a sensible size
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CLIPS))) await cache.delete(k);
  } catch { /* fine */ }
}

// Every clip an exercise list can play (for prefetchAudio).
export function audioOf(items) {
  const out = [];
  const add = (x) => { if (x && typeof x === 'string') out.push(x); };
  for (const ex of items || []) {
    add(ex.audio); add(ex.audio_q); add(ex.audio_msg);
    if (ex.item) { add(ex.item.audio); add(ex.item.ex_audio); }
    if (ex.pair_audio) Object.values(ex.pair_audio).forEach(add);
    if (ex.table && ex.table.rows) ex.table.rows.forEach((r) => add(r.audio));
  }
  return out;
}

function noAudio() {
  if (Date.now() - lastNoAudio < 20000) return;
  lastNoAudio = Date.now();
  toast(navigator.onLine === false ? '🔇 No connection — this audio is not on the phone yet.' : '🔇 This audio could not be played.', 3500);
}

// Starts at once (inside the tap, as iOS wants) from memory or the internet, and keeps a copy for later;
// without internet it plays the copy kept on the phone.
export function playAudio(url, rate) {
  if (!url || !player) return Promise.resolve(false);
  document.querySelectorAll('.play.playing').forEach((b) => b.classList.remove('playing'));
  player.pause();
  const start = (src, retry = true) => {
    player.src = src;
    player.defaultPlaybackRate = player.playbackRate = rate || settings.audio_rate || 1.0;
    player.preservesPitch = true;
    return player.play().then(() => true, (err) => {
      if (err && err.name === 'NotAllowedError') return false;  // autoplay before any tap: stay quiet
      if (retry && canCache() && src !== blobs.get(url)) {      // weak signal: try the copy on the phone
        return cachedBlobUrl(url).then((s) => (s ? start(s, false) : (noAudio(), false)));
      }
      noAudio();
      return false;
    });
  };
  const memo = blobs.get(url);
  if (memo || !canCache() || navigator.onLine !== false) {
    if (!memo && canCache()) cachedBlobUrl(url);               // keep a copy for the subte
    return start(memo || clipUrl(url));
  }
  return cachedBlobUrl(url).then((src) => (src ? start(src) : (noAudio(), false)));
}

// Play several clips one after another (a whole dialogue). Returns a stop function.
export function playAll(urls, onLine) {
  let i = 0; let stopped = false;
  const step = async () => {
    if (stopped || i >= urls.length) { if (onLine) onLine(-1); return; }
    if (onLine) onLine(i);
    const ok = await playAudio(urls[i]);
    if (!ok) { stopped = true; if (onLine) onLine(-1); return; }
    player.onended = () => { player.onended = null; i += 1; setTimeout(step, 350); };
  };
  step();
  return () => { stopped = true; player.onended = null; player.pause(); if (onLine) onLine(-1); };
}

// Play button (+ optional slow 0.75× button).  Disabled when there is no clip.
export function playBtn(url, { slow = true } = {}) {
  const wrap = h('span.row', { style: 'gap:4px;display:inline-flex;flex-wrap:nowrap' });
  const mk = (label, rate, cls, title) => h('button.play' + cls, {
    type: 'button', title: url ? title : 'No audio for this item yet', 'aria-label': url ? title : 'No audio', disabled: !url,
    onclick: (e) => {
      e.stopPropagation();
      const b = e.currentTarget; b.classList.add('playing');
      playAudio(url, rate).then((ok) => {
        if (!ok) { b.classList.remove('playing'); return; }
        player.onended = () => b.classList.remove('playing');
      });
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
// The table already shows the verb's memory tip (💡); older saved answers repeated it in "Why" — drop it there.
export function whyText(why, tb) {
  if (!why) return '';
  if (tb && tb.tip && why.includes(tb.tip)) why = why.replace(tb.tip, '').trim();
  return why;
}

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
