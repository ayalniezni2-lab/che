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
      e.target.value = '';
      try {
        const data = JSON.parse(await f.text());
        const answers = Object.values(data.history || {}).reduce((n, d) => n + ((d && d.answers) || 0), 0);
        const done = Object.values(data.units || {}).filter((u) => u && u.completed).length;
        if (!confirm(`Replace the progress on this ${isStatic ? 'phone' : 'computer'} with this file?\n\n`
          + `The file: ${answers} answers, ${done} chapters done (saved ${String(data.updated || '?').slice(0, 10)}).\n\n`
          + 'Your current progress is kept as an earlier copy (Settings → Earlier copies), so this can be undone.')) return;
        await api('progress/import', { data });
        toast('Progress imported.'); await refreshBoot(); go('#/home');
      } catch (err) { toast('Import failed: ' + err.message, 5000); }
    } });

  async function resetAll() {
    if (!confirm('Wipe all progress and start over?\n\nA copy of the current progress is kept under “Earlier copies” on this page, so it can be brought back.')) return;
    await api('progress/reset', { confirm: 'RESET' });
    toast('Progress reset.'); await refreshBoot(); go('#/home');
  }

  // Earlier copies: one a day (last 10 days) + a copy before every import / restore / start over
  const copies = h('div', h('p.small.muted', 'Loading…'));
  const loadCopies = async () => {
    const { items } = await api('progress/backups');
    copies.replaceChildren(items.length ? h('div', items.map((b) => h('div.row.between.copy-row',
      h('div', h('b', b.when), b.label ? h('span.tag', { style: 'margin-left:6px' }, b.label) : null,
        h('div.small.muted', `${b.answers} answers · ${b.chapters} chapters done · ${b.cards} review cards`)),
      h('button.btn.small', { onclick: async () => {
        if (!confirm(`Go back to the copy of ${b.when}?\n\nWhat you have now is kept as another copy first, so you can change your mind.`)) return;
        try { await api('progress/restore', { name: b.name }); toast('Restored.'); await refreshBoot(); go('#/home'); } catch (err) { toast(err.message, 5000); }
      } }, 'Go back to this')))) : h('p.small.muted', 'No copies yet — one is made every day you use Che!.'));
  };
  loadCopies().catch(() => copies.replaceChildren(h('p.small.muted', 'Could not list the copies.')));

  // Reported problems (🚩 on the feedback card): copy them for Claude (`fix:`), then clear the list
  const reportsBox = h('div', h('p.small.muted', 'Loading…'));
  const loadReports = async () => {
    const { items } = await api('reports');
    if (!items.length) { reportsBox.replaceChildren(h('p.small.muted', 'Nothing reported. When an answer or a sentence looks wrong, tap “🚩 Report a problem” under it.')); return; }
    const text = items.map((r) => `fix: [${r.id || '?'}] ${r.prompt || ''} ${r.es ? '— ' + r.es : ''} ${r.en ? '(' + r.en + ')' : ''}`
      + ` · expected: ${r.expected || '?'} · I typed: ${r.typed || '—'}${r.note ? ' · note: ' + r.note : ''}`).join('\n');
    reportsBox.replaceChildren(
      h('p.small.muted', `${items.length} problem${items.length === 1 ? '' : 's'} reported. Copy them and paste them to Claude — each line is a ready “fix:”.`),
      h('textarea.report-text', { readOnly: true, rows: Math.min(8, items.length + 1) }, text),
      h('div.row',
        h('button.btn.small', { onclick: async () => {
          try { await navigator.clipboard.writeText(text); toast('Copied.'); } catch { toast('Select the text and copy it by hand.'); }
        } }, '📋 Copy'),
        h('button.btn.small.ghost', { onclick: async () => {
          if (!confirm('Clear the list of reported problems?')) return;
          await api('reports/clear', {}); loadReports();
        } }, 'Clear the list')));
  };
  loadReports().catch(() => reportsBox.replaceChildren(h('p.small.muted', 'Could not load the reports.')));

  main.append(h('h1', 'Settings'),
    h('div.card', h('h3', 'Look'),
      h('div.row', 'Theme', select('theme', [['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']]))),
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
        ? 'Saved in this app on this phone only. Export now and then: the share sheet lets you save the file to Files (iCloud Drive) or send it to yourself on WhatsApp or by e-mail. That file is also how Claude sees your progress for a “refill”, and how you move to another device.'
        : `Saved on this computer in ${b.progress_dir || 'the progress folder'} (one copy a day for the last 10 days is in its "backups" folder). New versions of Che! find it there by themselves.`),
      h('div.row',
        h('button.btn', { onclick: async () => { if (await exportProgress()) toast('Progress exported — keep that file somewhere safe.', 4000); } }, isStatic ? '⬆ Export (share / save)' : '⬇ Export'),
        h('button.btn', { onclick: () => picker.click() }, isStatic ? '⬇ Import' : '⬆ Import'),
        h('button.btn.danger', { onclick: resetAll }, 'Start over'))),
    h('div.card', h('h3', 'Earlier copies'),
      h('p.muted.small', 'Che! keeps a copy of your progress every day (the last 10 days) and one before every import or “start over”. '
        + 'If something went wrong, go back to one of them.'), copies),
    h('div.card', h('h3', '🚩 Reported problems'), reportsBox),
    picker);
}
