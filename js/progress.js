// ── Supabase credentials ─────────────────────────────────────────────────────
// Replace with your Life Together project values from:
// Supabase dashboard → Project Settings → API
const SUPABASE_URL  = 'REPLACE_ME';
const SUPABASE_ANON = 'REPLACE_ME';

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
async function saveProgress(page) {
  const user = await getUser();
  if (!user) return;
  const data = {};
  document.querySelectorAll('textarea[id]').forEach(el => {
    data[el.id] = el.value;
  });
  await _sb.from('progress').upsert(
    { user_id: user.id, page, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,page' }
  );
  showSavedIndicator();
}

// ── Progress: load ────────────────────────────────────────────────────────────
async function loadProgress(page) {
  const user = await getUser();
  if (!user) return;
  const { data } = await _sb.from('progress')
    .select('data')
    .eq('page', page)
    .single();
  if (!data?.data) return;
  Object.entries(data.data).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

// ── Auto-save on textarea input (debounced 500ms) ─────────────────────────────
function initAutoSave(page) {
  let timer;
  document.querySelectorAll('textarea[id]').forEach(el => {
    el.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => saveProgress(page), 500);
    });
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
