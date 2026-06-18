// ── Supabase credentials ─────────────────────────────────────────────────────
// Replace with your Life Together project values from:
// Supabase dashboard → Project Settings → API
const SUPABASE_URL  = 'https://rcdyseqckkhpbllmkdov.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZHlzZXFja2tocGJsbG1rZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3ODg4NDcsImV4cCI6MjA5NzM2NDg0N30.QlfKk-xnU6bVsmFPon5XRlM12Yodb8AoX3EF0TWoTe0';

// ── Client ───────────────────────────────────────────────────────────────────
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Exchange magic-link token from URL hash on page load (Supabase handles automatically)
_sb.auth.onAuthStateChange((_event, _session) => {});

// ── Auth helpers ─────────────────────────────────────────────────────────────
async function getUser() {
  const { data: { session } } = await _sb.auth.getSession();
  return session?.user ?? null;
}

// ── Progress: save ────────────────────────────────────────────────────────────
// Captures every textarea/input with an id. Widgets whose state lives only in a
// JS variable (tag selections, sticky notes, checklists, dynamic lists) mirror
// their state into a hidden <input type="hidden" id="..."> so it's captured here
// the same way — see each page's syncXState()-style helper.
async function saveProgress(page) {
  const user = await getUser();
  if (!user) return;
  const data = {};
  document.querySelectorAll('textarea[id], input[id]').forEach(el => {
    data[el.id] = el.value;
  });
  await _sb.from('progress').upsert(
    { user_id: user.id, page, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,page' }
  );
  showSavedIndicator();
}

// ── Progress: load ────────────────────────────────────────────────────────────
// Populates any existing textarea/input by id, and returns the raw saved data
// object so pages can rehydrate widgets that need more than `el.value = val`
// (sliders driving a canvas, hidden-JSON state driving a rebuilt list, etc).
async function loadProgress(page) {
  const user = await getUser();
  if (!user) return null;
  const { data } = await _sb.from('progress')
    .select('data')
    .eq('page', page)
    .single();
  if (!data?.data) return null;
  Object.entries(data.data).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  return data.data;
}

// ── Progress: completion tick ──────────────────────────────────────────────
async function setCompleted(page, completed) {
  const user = await getUser();
  if (!user) return;
  await _sb.from('progress').upsert(
    { user_id: user.id, page, completed, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,page' }
  );
}

async function getCompleted(page) {
  const user = await getUser();
  if (!user) return false;
  const { data } = await _sb.from('progress').select('completed').eq('page', page).single();
  return !!(data && data.completed);
}

// Returns { [page]: { completed, data } } for every page the user has touched.
async function getAllProgress() {
  const user = await getUser();
  if (!user) return {};
  const { data } = await _sb.from('progress')
    .select('page, completed, data')
    .eq('user_id', user.id);
  const map = {};
  (data || []).forEach(row => { map[row.page] = { completed: !!row.completed, data: row.data || {} }; });
  return map;
}

// ── Timeline navigation: save current page before leaving ────────────────────
async function flushAndGo(url) {
  const page = location.pathname.split('/').pop().replace('.html', '');
  await saveProgress(page);
  window.location.href = url;
}

// ── Auto-save on textarea/input change (debounced 500ms) ─────────────────────
// Shared timer so any widget can trigger a save via scheduleSave(page) —
// used by JS-only-state widgets right after they sync their hidden field.
let _saveTimer;
function scheduleSave(page) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveProgress(page), 500);
}

function initAutoSave(page) {
  document.querySelectorAll('textarea[id], input[id]').forEach(el => {
    el.addEventListener('input', () => scheduleSave(page));
  });
}

// ── Subtle "Saved" indicator ──────────────────────────────────────────────────
function showSavedIndicator() {
  let el = document.getElementById('_progress_saved');
  if (!el) {
    el = document.createElement('div');
    el.id = '_progress_saved';
    el.style.cssText = [
      'position:fixed', 'bottom:1.25rem', 'right:1.25rem',
      'background:rgba(44,74,90,0.85)', 'color:#FDFAF5',
      'font-family:Jost,sans-serif', 'font-size:0.72rem',
      'letter-spacing:0.08em', 'padding:0.4rem 0.9rem',
      'border-radius:20px', 'opacity:0',
      'transition:opacity 0.3s', 'pointer-events:none', 'z-index:9999'
    ].join(';');
    el.textContent = '✓ Progress saved';
    document.body.appendChild(el);
  }
  el.style.opacity = '1';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}
