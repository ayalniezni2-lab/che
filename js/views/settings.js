// Settings: theme, audio, typing helpers, vulgar opt-in, export / import, placement redo.
import { api, h, toast, settings, exportProgress } from '../ui.js';
import { applyTheme, refreshBoot, go } from '../app.js';
import { isStatic } from '../backend.js';

export default async function (main) {
  const b = await refreshBoot();
  const s = b.settings;
  const save = async (patch) => {
    Object.assign(s, patch); Object.assign(settings, patch);
    await api('settings', patch); applyTheme(s.theme);
  };
  const select = (key, opts) => h('select.sel', {
    onchange: (e) => save({ [key]: isNaN(e.target.value) ? e.target.value : Number(e.target.value) }) },
  opts.map(([v, l]) => h('option', { value: v, selected: String(s[key]) === String(v) }, l)));
  const check = (key, label, note) => h('label.row', { style: 'margin:8px 0' },
    h('input', { type: 'checkbox', checked: !!s[key], onchange: (e) => save({ [key]: e.target.checked }) }),
    h('span', label, note ? h('div.small.muted', note) : null));

  const picker = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none',
    onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        await api('progress/import', { data: JSON.parse(await f.text()) });
        toast('Progress imported.'); await refreshBoot(); go('#/home');
      } catch (err) { toast('Import failed: ' + err.message, 5000); }
    } });

  async function resetAll() {
    if (!confirm('Wipe all progress and start over? (A backup copy is kept in progress/backups/.)')) return;
    await api('progress/reset', { confirm: 'RESET' });
    toast('Progress reset.'); await refreshBoot(); go('#/home');
  }

  main.append(h('h1', 'Settings'),
    h('div.card', h('h3', 'Look'),
      h('div.row', 'Theme', select('theme', [['auto', 'Match my computer'], ['light', 'Light'], ['dark', 'Dark']]))),
    h('div.card', h('h3', 'Audio'),
      h('div.row', 'Default speed', select('audio_rate', [[1, 'Normal'], [0.75, 'Slow (0.75×)']])),
      check('autoplay', 'Play audio automatically', 'On listening exercises and after each answer.')),
    h('div.card', h('h3', 'Typing'),
      check('shortcuts', "Typing shortcuts:  a' → á,  n~ → ñ,  ?? → ¿,  !! → ¡",
        'Optional. Plain letters are always accepted — you never lose points for accents.')),
    h('div.card', h('h3', 'Daily session'),
      h('div.row', 'Length', select('session_minutes',
        [[10, 'About 10 minutes'], [15, 'About 15 minutes'], [25, 'About 25 minutes']]))),
    h('div.card', h('h3', 'Vulgar words'),
      check('vulgar', 'Include vulgar words and expressions',
        'Off by default. Each one comes with a note about when it is OK to say it.')),
    h('div.card', h('h3', 'Placement test'),
      h('p.muted.small', b.placement.done
        ? `Done — you started at level ${String(b.placement.level).toUpperCase()}.` : 'Not taken yet.'),
      h('button.btn', { onclick: () => go('#/placement') },
        b.placement.done ? 'Redo the placement test' : 'Take the placement test')),
    h('div.card', h('h3', 'Your progress file'),
      h('p.muted.small', isStatic
        ? 'Saved in this browser on this device only. Export now and then to keep a copy (or to move to another device), and add Che! to your home screen so the phone keeps it.'
        : `Saved on this computer in ${b.progress_dir || 'the progress folder'} (the last 10 backups are in its "backups" folder). New versions of Che! find it there by themselves.`),
      h('div.row',
        h('button.btn', { onclick: async () => { await exportProgress(); toast('Progress exported — keep that file somewhere safe.', 4000); } }, '⬇ Export'),
        h('button.btn', { onclick: () => picker.click() }, '⬆ Import'),
        h('button.btn.danger', { onclick: resetAll }, 'Start over'))),
    picker);
}
