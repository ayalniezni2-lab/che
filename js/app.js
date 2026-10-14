// Che! — app shell: bootstrap, theme, hash router, phone tab bar.
import { api, h, settings, toast } from './ui.js';
import { isStatic, engineReady } from './backend.js';

export const state = { boot: null, snapshot: false };

const ROUTES = {
  home: () => import('./views/home.js'),
  learn: () => import('./views/learn.js'),
  unit: () => import('./views/unit.js'),
  session: () => import('./views/session.js'),
  practice: () => import('./views/practice.js'),
  notebook: () => import('./views/notebook.js'),
  verbs: () => import('./views/verbs.js'),
  words: () => import('./views/words.js'),
  culture: () => import('./views/culture.js'),
  stats: () => import('./views/stats.js'),
  settings: () => import('./views/settings.js'),
  placement: () => import('./views/placement.js'),
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: fine */ } },
};
export { store };

export function applyTheme(theme) {
  let t = theme || 'auto';
  store.set('che-theme', t);                   // index.html reads it before the first paint
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
}

function showStreak(s) {
  const txt = s ? `🔥 ${s}-day streak` : 'No streak yet — start today';
  document.getElementById('nav-streak').textContent = txt;
  document.getElementById('phone-streak').textContent = s ? `🔥 ${s}` : '';
}

export async function refreshBoot() {
  state.boot = await api('bootstrap');
  state.snapshot = false;
  Object.assign(settings, state.boot.settings);
  applyTheme(settings.theme);
  showStreak(state.boot.streak);
  // a copy of the home page's data: next time the home page shows at once, while the engine loads
  if (isStatic) store.set('che-boot', JSON.stringify(state.boot));
  return state.boot;
}

// The home page may draw from the saved copy while the engine is still starting (phone version only).
export function bootSnapshot() {
  if (!isStatic || engineReady()) return null;
  try { return JSON.parse(store.get('che-boot') || 'null'); } catch { return null; }
}

export function go(hash) { location.hash = hash; }

// Exercises fill the screen: no tab bar (it would also sit on top of the phone keyboard).
export function focusMode(on) { document.body.classList.toggle('in-exercise', !!on); }

let cleanup = null;
let renderNo = 0;
async function render() {
  const main = document.getElementById('main');
  const [name, ...args] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  const loader = ROUTES[name] || ROUTES.home;
  const no = ++renderNo;
  closeMore();
  focusMode(false);
  document.querySelectorAll('#nav a[data-nav]').forEach((a) => {
    const on = a.dataset.nav === name || (name === 'unit' && a.dataset.nav === 'learn')
      || (name === 'session' && a.dataset.nav === 'home');
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.getElementById('more-btn').classList.toggle('active',
    !!document.querySelector('#nav a.more-item.active'));
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  try {
    if (!state.boot) {
      const snap = (name === 'home' || name === '') ? bootSnapshot() : null;
      if (snap && snap.placement && snap.placement.done) {
        // phone: draw the home page from last time straight away; refresh it when the engine is ready
        state.boot = snap; state.snapshot = true;
        Object.assign(settings, snap.settings || {});
        showStreak(snap.streak);
        const mod = await loader();
        main.replaceChildren();
        cleanup = (await mod.default(main, [])) || null;
        refreshBoot().then(() => { if (no === renderNo) render(); }).catch(() => { /* the next view shows the error */ });
        return;
      }
      await refreshBoot();
    }
    // First visit: offer the placement test before anything else.
    if (name === 'home' && !state.boot.placement.done && !store.get('che-skip-placement')
        && state.boot.counts.units > 0) { go('#/placement'); return; }
    const mod = await loader();
    if (no !== renderNo) return;
    main.replaceChildren();
    cleanup = (await mod.default(main, args.map(decodeURIComponent))) || null;
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    showError(err);
  }
}

export function showError(err) {
  const main = document.getElementById('main');
  main.replaceChildren(h('div.card', { role: 'alert' }, h('h2', 'Something went wrong'), h('p', String((err && err.message) || err)),
    h('p.muted.small', isStatic ? 'Check your internet connection the first time you open Che!, then reload.'
      : 'Is the Che! window (the black one that start.bat opened) still running?'),
    h('button.btn', { onclick: () => location.reload() }, 'Reload')));
}

// ---------------------------------------------------------------- phone: "More" sheet for the less used tabs
function closeMore() {
  document.body.classList.remove('more-open');
  document.getElementById('more-btn').setAttribute('aria-expanded', 'false');
  const sheet = document.getElementById('more-sheet');
  if (sheet) sheet.remove();
}
document.getElementById('more-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (document.body.classList.contains('more-open')) { closeMore(); return; }
  const links = [...document.querySelectorAll('#nav a.more-item')].map((a) =>
    h('a', { href: a.getAttribute('href'), class: a.classList.contains('active') ? 'active' : '' }, a.textContent.trim()));
  document.body.append(h('div#more-sheet', { role: 'menu' }, links));
  document.body.classList.add('more-open');
  e.currentTarget.setAttribute('aria-expanded', 'true');
});
document.addEventListener('click', (e) => {
  if (document.body.classList.contains('more-open') && !e.target.closest('#more-sheet')) closeMore();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMore(); });

window.addEventListener('hashchange', render);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(settings.theme));
window.addEventListener('error', (e) => toast('Error: ' + e.message, 5000));
window.addEventListener('unhandledrejection', (e) => {          // a tap that failed must never fail silently
  const r = e.reason;
  toast('Something went wrong: ' + ((r && r.message) || r || 'unknown error') + ' — try again.', 5000);
});
render();

// web version: keep the app itself on the phone so it opens fast (and without internet after the first time)
// Updates: look for a new version every time the app is opened or comes back to the front. When one has been
// installed, switch to it - at once on a quiet page, or via a banner otherwise. Progress is kept in the phone's
// storage and is not touched by an update.
if (isStatic && 'serviceWorker' in navigator) {
  const hadVersion = !!navigator.serviceWorker.controller;      // false on the very first visit
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const check = () => reg.update().catch(() => { /* offline: try again next time */ });
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch((err) => console.warn('Offline cache not available', err));
  let switching = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadVersion || switching) return;
    switching = true;
    const quiet = /^#?\/?(home)?$/.test(location.hash) || /^#\/(learn|stats)$/.test(location.hash);
    if (quiet && !document.body.classList.contains('in-exercise')) { location.reload(); return; }
    document.body.append(h('div.update-bar', 'A new version of Che! is ready.',
      h('button.btn.primary', { onclick: () => location.reload() }, 'Update now')));
  });
}
