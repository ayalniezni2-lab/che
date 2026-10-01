// Phone / web version: runs the Che! Python engine inside the browser with Pyodide, so no server is needed.
// Progress lives in this browser's own storage (IndexedDB, mounted at /app/progress): every phone keeps its own.
// The computer version (start.bat) never loads this: window.CHE_STATIC is only set by tools/build_site.py.
export const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.29.5/full/';
export const isStatic = !!window.CHE_STATIC;

let py = null;
let bridgeCall = null;
let booting = null;
let saving = Promise.resolve();

function status(msg) {
  const el = document.getElementById('boot-status');
  if (el) el.textContent = msg;
}

function syncfs(populate) {
  return new Promise((resolve, reject) => py.FS.syncfs(populate, (err) => (err ? reject(err) : resolve())));
}

export function boot() {
  if (!booting) {
    booting = (async () => {
      status('Loading the Spanish engine… (the first time takes a little while)');
      const { loadPyodide } = await import(PYODIDE_URL + 'pyodide.mjs');
      py = await loadPyodide({ indexURL: PYODIDE_URL });
      status('Unpacking the lessons…');
      const res = await fetch('engine.zip?v=' + encodeURIComponent(window.CHE_BUILD || ''));
      if (!res.ok) throw new Error('Could not load the lessons (engine.zip: ' + res.status + ')');
      py.unpackArchive(await res.arrayBuffer(), 'zip', { extractDir: '/app' });
      py.FS.mkdirTree('/app/progress');
      py.FS.mount(py.FS.filesystems.IDBFS, {}, '/app/progress');
      await syncfs(true);                            // bring back this phone's saved progress
      status('Almost ready…');
      py.runPython("import sys\nsys.path.insert(0, '/app')\nfrom che import web_bridge\nweb_bridge.init()");
      bridgeCall = py.pyimport('che.web_bridge').call;
      await syncfs(false);
      // ask the browser not to clear this storage when space runs low (granted more often once installed)
      try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch { /* optional */ }
      return py;
    })();
    booting.catch(() => { booting = null; });        // a failed first load can be retried with Reload
  }
  return booting;
}

// Same contract as a request to the local server: {code, payload} or {code, download}.
export async function call(method, path, query, body) {
  await boot();
  const out = JSON.parse(bridgeCall(method, path, JSON.stringify(query || {}), JSON.stringify(body || {})));
  if (method === 'POST') {                           // anything that changes progress: write it to storage
    saving = saving.then(() => syncfs(false)).catch((err) => console.error('Saving progress failed', err));
  }
  return out;
}

export function flush() { return py ? saving.then(() => syncfs(false)) : Promise.resolve(); }

if (isStatic) {
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}
