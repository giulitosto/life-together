// ── Supabase credentials ─────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://rcdyseqckkhpbllmkdov.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZHlzZXFja2tocGJsbG1rZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3ODg4NDcsImV4cCI6MjA5NzM2NDg0N30.QlfKk-xnU6bVsmFPon5XRlM12Yodb8AoX3EF0TWoTe0';

// ── Client ───────────────────────────────────────────────────────────────────
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

_sb.auth.onAuthStateChange((_event, _session) => {});

// ── Auth helpers ─────────────────────────────────────────────────────────────
async function getUser() {
  const { data: { session } } = await _sb.auth.getSession();
  return session?.user ?? null;
}

// ── Profile helpers ───────────────────────────────────────────────────────────
// Returns { display_name, partner_name, partner_email, couple_id } or null.
let _profileCache = null;
async function getProfile() {
  if (_profileCache) return _profileCache;
  const user = await getUser();
  if (!user) return null;
  const { data } = await _sb.from('profiles')
    .select('display_name, partner_name, partner_email, couple_id')
    .eq('id', user.id)
    .single();
  _profileCache = data || {};
  return _profileCache;
}

async function setProfile(fields) {
  const user = await getUser();
  if (!user) return;
  await _sb.from('profiles').upsert({ id: user.id, ...fields }, { onConflict: 'id' });
  _profileCache = { ..._profileCache, ...fields };
}

// ── Couple identity (fixed, not self-referential) ──────────────────────────────
// Returns { isUserA, nameA, nameB }, where "A" and "B" always mean the couple's
// user_a and user_b (fixed by the couples row), the same for both partners.
// Use this instead of profile.display_name/partner_name whenever a page needs
// to know who is "A" and who is "B", otherwise each partner sees themselves as
// A and their partner as B, which collides on any shared a/b input field.
let _coupleIdentityCache = null;
async function getCoupleIdentity() {
  if (_coupleIdentityCache) return _coupleIdentityCache;
  const user = await getUser();
  if (!user) return null;
  const profile = await getProfile();
  if (!profile?.couple_id) return null;

  const { data: couple } = await _sb.from('couples')
    .select('user_a, user_b')
    .eq('id', profile.couple_id)
    .single();
  if (!couple) return null;

  const ids = [couple.user_a, couple.user_b].filter(Boolean);
  const { data: profiles } = await _sb.from('profiles')
    .select('id, display_name')
    .in('id', ids);
  const byId = {};
  (profiles || []).forEach(p => { byId[p.id] = p.display_name; });

  _coupleIdentityCache = {
    isUserA: user.id === couple.user_a,
    nameA: byId[couple.user_a] || 'Person A',
    nameB: (couple.user_b && byId[couple.user_b]) || 'Person B'
  };
  return _coupleIdentityCache;
}

// ── Couple helpers ────────────────────────────────────────────────────────────
// Creates a couple record, stores couple_id on the current user's profile,
// and returns { couple_id, invite_token } so the caller can show the invite link.
async function createCouple(partnerEmail, partnerName) {
  const user = await getUser();
  if (!user) return null;
  const { data: couple, error } = await _sb.from('couples')
    .insert({ user_a: user.id })
    .select('id, invite_token')
    .single();
  if (error) throw error;
  await setProfile({ partner_email: partnerEmail, partner_name: partnerName, couple_id: couple.id });
  return { couple_id: couple.id, invite_token: couple.invite_token };
}

// Called on join.html: links the signed-in user as user_b via the invite token.
async function acceptCoupleInvite(token) {
  const { data, error } = await _sb.rpc('accept_couple_invite', { invite_token_param: token });
  if (error) throw error;
  _profileCache = null; // bust cache so couple_id reloads
  return data; // returns couple_id
}

// ── Couple page routing ───────────────────────────────────────────────────────
function _isCouplePage(page) {
  return /^module-[23]/.test(page);
}

async function _getCoupleId() {
  const profile = await getProfile();
  return profile?.couple_id || null;
}

// ── Progress: save ────────────────────────────────────────────────────────────
// M1 pages save per user_id; M2+M3 pages save per couple_id.
async function saveProgress(page) {
  const user = await getUser();
  if (!user) return;
  const data = {};
  document.querySelectorAll('textarea[id], input[id]').forEach(el => {
    data[el.id] = el.value;
  });

  if (_isCouplePage(page)) {
    const coupleId = await _getCoupleId();
    if (!coupleId) return; // couple not linked yet — don't save to wrong table
    await _sb.from('couple_progress').upsert(
      { couple_id: coupleId, page, data, updated_at: new Date().toISOString() },
      { onConflict: 'couple_id,page' }
    );
  } else {
    await _sb.from('progress').upsert(
      { user_id: user.id, page, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,page' }
    );
  }
  showSavedIndicator();
}

// ── Progress: load ────────────────────────────────────────────────────────────
async function loadProgress(page) {
  const user = await getUser();
  if (!user) return null;

  let row;
  if (_isCouplePage(page)) {
    const coupleId = await _getCoupleId();
    if (!coupleId) return null;
    const { data } = await _sb.from('couple_progress')
      .select('data')
      .eq('couple_id', coupleId)
      .eq('page', page)
      .single();
    row = data;
  } else {
    const { data } = await _sb.from('progress')
      .select('data')
      .eq('user_id', user.id)
      .eq('page', page)
      .single();
    row = data;
  }

  if (!row?.data) return null;
  Object.entries(row.data).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  return row.data;
}

// ── Progress: completion tick ─────────────────────────────────────────────────
async function setCompleted(page, completed) {
  const user = await getUser();
  if (!user) return;

  if (_isCouplePage(page)) {
    const coupleId = await _getCoupleId();
    if (!coupleId) return;
    await _sb.from('couple_progress').upsert(
      { couple_id: coupleId, page, completed, updated_at: new Date().toISOString() },
      { onConflict: 'couple_id,page' }
    );
  } else {
    await _sb.from('progress').upsert(
      { user_id: user.id, page, completed, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,page' }
    );
  }
}

async function getCompleted(page) {
  const user = await getUser();
  if (!user) return false;

  if (_isCouplePage(page)) {
    const coupleId = await _getCoupleId();
    if (!coupleId) return false;
    const { data } = await _sb.from('couple_progress')
      .select('completed')
      .eq('couple_id', coupleId)
      .eq('page', page)
      .single();
    return !!(data && data.completed);
  } else {
    const { data } = await _sb.from('progress')
      .select('completed')
      .eq('user_id', user.id)
      .eq('page', page)
      .single();
    return !!(data && data.completed);
  }
}

// Returns { [page]: { completed, data } } for every page the user has touched.
// Merges M1 (per user) and M2+M3 (per couple).
async function getAllProgress() {
  const user = await getUser();
  if (!user) return {};
  const map = {};

  const { data: userRows } = await _sb.from('progress')
    .select('page, completed, data')
    .eq('user_id', user.id);
  (userRows || []).forEach(row => {
    map[row.page] = { completed: !!row.completed, data: row.data || {} };
  });

  const coupleId = await _getCoupleId();
  if (coupleId) {
    const { data: coupleRows } = await _sb.from('couple_progress')
      .select('page, completed, data')
      .eq('couple_id', coupleId);
    (coupleRows || []).forEach(row => {
      map[row.page] = { completed: !!row.completed, data: row.data || {} };
    });
  }

  return map;
}

// ── Timeline navigation: save current page before leaving ────────────────────
async function flushAndGo(url) {
  const page = location.pathname.split('/').pop().replace('.html', '');
  await saveProgress(page);
  window.location.href = url;
}

// ── Auto-save on textarea/input change (debounced 500ms) ─────────────────────
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
