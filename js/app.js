// Che! — app shell: bootstrap, theme, hash router.
import { api, h, settings, toast } from './ui.js';
import { isStatic } from './backend.js';

export const state = { boot: null };

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

export function applyTheme(theme) {
  let t = theme || 'auto';
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
}

export async function refreshBoot() {
  state.boot = await api('bootstrap');
  Object.assign(settings, state.boot.settings);
  applyTheme(settings.theme);
  const s = state.boot.streak;
  document.getElementById('nav-streak').textContent = s ? `🔥 ${s}-day streak` : 'No streak yet — start today';
  return state.boot;
}

export function go(hash) { location.hash = hash; }

let cleanup = null;
async function render() {
  const main = document.getElementById('main');
  const [name, ...args] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  const loader = ROUTES[name] || ROUTES.home;
  document.querySelectorAll('#nav a[data-nav]').forEach((a) =>
    a.classList.toggle('active', a.dataset.nav === name || (name === 'unit' && a.dataset.nav === 'learn')
      || (name === 'session' && a.dataset.nav === 'home')));
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  try {
    if (!state.boot) await refreshBoot();
    // First visit: offer the placement test before anything else.
    if (name === 'home' && !state.boot.placement.done && !sessionStorage.getItem('skipPlacement')
        && state.boot.counts.units > 0) { go('#/placement'); return; }
    const mod = await loader();
    main.replaceChildren();
    cleanup = (await mod.default(main, args.map(decodeURIComponent))) || null;
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div.card', h('h2', 'Something went wrong'), h('p', String(err.message || err)),
      h('p.muted.small', isStatic ? 'Check your internet connection the first time you open Che!, then reload.'
        : 'Is the Che! window (the black one that start.bat opened) still running?'),
      h('button.btn', { onclick: () => location.reload() }, 'Reload')));
  }
}

window.addEventListener('hashchange', render);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(settings.theme));
window.addEventListener('error', (e) => toast('Error: ' + e.message));
render();

// web version: keep the app itself on the phone so it opens fast (and without internet after the first time)
if (isStatic && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline cache not available', err));
}
