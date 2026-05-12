// ============================================
// FOODIE app.js — Apple-style web app
// Base de datos: JSONBin.io (gratuito)
// ============================================

// 🔑 CONFIGURA AQUI TUS DATOS DE JSONBIN.IO
const JSONBIN_API_KEY = '$2a$10$vn9zCHL4XfO2iTu60MmURunpFsyukhGYuC4.BNkskFjP95GLR.2IO';
const JSONBIN_BIN_ID  = '6a0326d9250b1311c33c00da';
const API_URL = 'https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID;

// ============================================
// ESTADO
// ============================================
let places = [];
let currentTags = [];
let editingId = null;
let activeCategory = '';

// ============================================
// API
// ============================================
async function fetchPlaces() {
  showLoader(true);
  try {
    const res = await fetch(API_URL + '/latest', {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    places = json.record?.places || [];
  } catch (e) {
    console.error(e);
    showToast('No se pudo conectar. Verifica tu API Key y Bin ID.');
    places = [];
  } finally {
    showLoader(false);
  }
}

async function savePlaces() {
  const res = await fetch(API_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_API_KEY
    },
    body: JSON.stringify({ places })
  });
  if (!res.ok) throw new Error('Error guardando: ' + res.status);
}

// ============================================
// UTILIDADES
// ============================================
const CAT = {
  entrada:        { label: 'Entrada',    emoji: '🥗', badge: 'badge-entrada' },
  platoPrincipal: { label: 'Principal',  emoji: '🍽', badge: 'badge-platoPrincipal' },
  postre:         { label: 'Postre',     emoji: '🎂', badge: 'badge-postre' },
  bebida:         { label: 'Bebida',     emoji: '☕', badge: 'badge-bebida' },
  snack:          { label: 'Snack',      emoji: '🍿', badge: 'badge-snack' },
  otro:           { label: 'Otro',       emoji: '✦',  badge: 'badge-otro' }
};

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function starsHTML(n) {
  let h = '';
  for (let i = 1; i <= 5; i++) {
    h += '<span style="color:' + (i <= n ? '#FFB400' : '#E5E5EA') + '">★</span>';
  }
  return h;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function showLoader(show) {
  document.getElementById('state-loader').style.display = show ? 'flex' : 'none';
}

// ============================================
// RENDER
// ============================================
function renderGrid(list) {
  const grid = document.getElementById('places-grid');
  const empty = document.getElementById('state-empty');

  if (!list.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = list.map((p, i) => {
    const cat = CAT[p.category] || CAT.otro;
    const tagsHTML = (p.favoriteIngredients || [])
      .map(t => '<span class="card-tag">' + esc(t) + '</span>').join('');
    return `<div class="place-card" style="animation-delay:${i * 60}ms">
      <div class="card-strip strip-${esc(p.category)}"></div>
      <div class="card-body">
        <div class="card-top">
          <div>
            <div class="card-name">${esc(p.name)}</div>
            <div class="card-restaurant">📍 ${esc(p.restaurant)}</div>
          </div>
          <span class="card-badge ${cat.badge}">${cat.emoji} ${cat.label}</span>
        </div>
        <div class="card-stars">${starsHTML(p.rating)}</div>
        ${p.notes ? `<p class="card-notes">${esc(p.notes)}</p>` : ''}
        ${tagsHTML ? `<div class="card-tags">${tagsHTML}</div>` : ''}
      </div>
      <div class="card-footer">
        <span class="card-date">${fmtDate(p.dateAdded)}</span>
        <div class="card-btns">
          <button class="icon-btn" title="Editar" onclick="openEditModal('${p.id}')">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="icon-btn danger" title="Eliminar" onclick="deletePlace('${p.id}')">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ============================================
// FILTROS & STATS
// ============================================
function applyFilters() {
  const q = (document.getElementById('search').value || '').toLowerCase();

  const filtered = places.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.restaurant.toLowerCase().includes(q);
    const matchC = !activeCategory || p.category === activeCategory;
    return matchQ && matchC;
  });

  renderGrid(filtered);
  updateStats(filtered);
}

function updateStats(list) {
  const total = list.length;
  const avg = total
    ? (list.reduce((s, p) => s + (p.rating || 0), 0) / total).toFixed(1)
    : '—';

  const counts = {};
  list.forEach(p => counts[p.category] = (counts[p.category] || 0) + 1);
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
  const topLabel = top ? (CAT[top[0]]?.emoji + ' ' + CAT[top[0]]?.label) : '—';

  animateNum('stat-total', total);
  document.getElementById('stat-avg').textContent = avg === '—' ? '—' : avg + ' ⭐';
  document.getElementById('stat-top').textContent = topLabel;
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  const dur = 400;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = Math.round(start + diff * p);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ============================================
// MODAL
// ============================================
function openModal() {
  editingId = null;
  currentTags = [];
  document.getElementById('modal-title').textContent = 'Nuevo lugar';
  document.getElementById('place-form').reset();
  document.getElementById('place-id').value = '';
  setStars(3);
  renderTagList();
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('field-name').focus();
  // reset scrim/card animations
  const scrim = document.getElementById('modal-scrim');
  const card = document.getElementById('modal-card');
  scrim.classList.remove('closing');
  card.classList.remove('closing');
}

function openEditModal(id) {
  const p = places.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  currentTags = [...(p.favoriteIngredients || [])];
  document.getElementById('modal-title').textContent = 'Editar lugar';
  document.getElementById('place-id').value = p.id;
  document.getElementById('field-name').value = p.name;
  document.getElementById('field-restaurant').value = p.restaurant;
  document.getElementById('field-category').value = p.category;
  document.getElementById('field-notes').value = p.notes || '';
  setStars(p.rating || 3);
  renderTagList();
  document.getElementById('modal').classList.remove('hidden');
  const scrim = document.getElementById('modal-scrim');
  const card = document.getElementById('modal-card');
  scrim.classList.remove('closing');
  card.classList.remove('closing');
}

function closeModal() {
  const scrim = document.getElementById('modal-scrim');
  const card = document.getElementById('modal-card');
  scrim.classList.add('closing');
  card.classList.add('closing');
  setTimeout(() => {
    document.getElementById('modal').classList.add('hidden');
    scrim.classList.remove('closing');
    card.classList.remove('closing');
  }, 300);
}

// ============================================
// STARS
// ============================================
function setStars(n) {
  document.getElementById('field-rating').value = n;
  document.querySelectorAll('#star-picker .star').forEach((s, i) => {
    s.classList.toggle('lit', i < n);
  });
}

document.getElementById('star-picker').addEventListener('click', e => {
  const btn = e.target.closest('.star');
  if (btn) setStars(parseInt(btn.dataset.val));
});

// Hover preview
document.getElementById('star-picker').addEventListener('mouseover', e => {
  const btn = e.target.closest('.star');
  if (!btn) return;
  const n = parseInt(btn.dataset.val);
  document.querySelectorAll('#star-picker .star').forEach((s, i) => {
    s.style.color = i < n ? '#FFB400' : '';
  });
});
document.getElementById('star-picker').addEventListener('mouseleave', () => {
  const n = parseInt(document.getElementById('field-rating').value);
  setStars(n);
});

// ============================================
// TAGS
// ============================================
function renderTagList() {
  const list = document.getElementById('tag-list');
  list.innerHTML = currentTags.map((t, i) => `
    <span class="tag-pill">
      ${esc(t)}
      <span class="tag-remove" data-i="${i}" role="button" aria-label="Eliminar ${esc(t)}">×</span>
    </span>
  `).join('');
  list.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTags.splice(parseInt(btn.dataset.i), 1);
      renderTagList();
    });
  });
}

document.getElementById('tag-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = e.target.value.trim();
    if (v && !currentTags.includes(v) && currentTags.length < 10) {
      currentTags.push(v);
      renderTagList();
    }
    e.target.value = '';
  }
});

document.getElementById('tag-box').addEventListener('click', () => {
  document.getElementById('tag-input').focus();
});

// ============================================
// FORM SUBMIT
// ============================================
document.getElementById('place-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  const entry = {
    id: editingId || crypto.randomUUID(),
    name: document.getElementById('field-name').value.trim(),
    restaurant: document.getElementById('field-restaurant').value.trim(),
    category: document.getElementById('field-category').value,
    rating: parseInt(document.getElementById('field-rating').value) || 3,
    notes: document.getElementById('field-notes').value.trim(),
    favoriteIngredients: [...currentTags],
    dateAdded: editingId
      ? (places.find(p => p.id === editingId)?.dateAdded || new Date().toISOString())
      : new Date().toISOString()
  };

  if (editingId) {
    places = places.map(p => p.id === editingId ? entry : p);
  } else {
    places.unshift(entry);
  }

  try {
    await savePlaces();
    closeModal();
    applyFilters();
    showToast(editingId ? '✓ Lugar actualizado' : '🎉 Lugar añadido');
  } catch (err) {
    console.error(err);
    showToast('Error al guardar. Inténtalo de nuevo.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
});

// ============================================
// DELETE
// ============================================
async function deletePlace(id) {
  if (!confirm('¿Eliminar este lugar?')) return;
  const prev = [...places];
  places = places.filter(p => p.id !== id);
  try {
    await savePlaces();
    applyFilters();
    showToast('Lugar eliminado');
  } catch (err) {
    places = prev;
    showToast('Error al eliminar');
  }
}

// ============================================
// TOAST
// ============================================
let toastTimer = null;
// FOODIE app.js — Apple-style web app
// Base de datos: JSONBin.io (gratuito)
// ============================================

// Configura aqui tus datos de JSONBin.io
const JSONBIN_API_KEY = 'TU_API_KEY_AQUI';
const JSONBIN_BIN_ID  = 'TU_BIN_ID_AQUI';
const API_URL = 'https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID;

let places = [];
let currentTags = [];
let editingId = null;
let activeCategory = '';

async function fetchPlaces() {
  showLoader(true);
  try {
    const res = await fetch(API_URL + '/latest', {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    places = json.record?.places || [];
  } catch (e) {
    showToast('No se pudo conectar. Verifica tu API Key y Bin ID.');
    places = [];
  } finally {
    showLoader(false);
  }
}

async function savePlaces() {
  const res = await fetch(API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
    body: JSON.stringify({ places })
  });
  if (!res.ok) throw new Error('Error guardando: ' + res.status);
}

const CAT = {
  entrada:        { label: 'Entrada',   emoji: '🥗', badge: 'badge-entrada' },
  platoPrincipal: { label: 'Principal', emoji: '🍽', badge: 'badge-platoPrincipal' },
  postre:         { label: 'Postre',    emoji: '🎂', badge: 'badge-postre' },
  bebida:         { label: 'Bebida',    emoji: '☕', badge: 'badge-bebida' },
  snack:          { label: 'Snack',     emoji: '🍿', badge: 'badge-snack' },
  otro:           { label: 'Otro',      emoji: '✦',  badge: 'badge-otro' }
};

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function starsHTML(n) {
  let h = '';
  for (let i = 1; i <= 5; i++) h += '<span style="color:' + (i <= n ? '#FFB400' : '#E5E5EA') + '">★</span>';
  return h;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showLoader(show) {
  document.getElementById('state-loader').style.display = show ? 'flex' : 'none';
}

function renderGrid(list) {
  const grid = document.getElementById('places-grid');
  const empty = document.getElementById('state-empty');
  if (!list.length) { grid.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  grid.innerHTML = list.map((p, i) => {
    const cat = CAT[p.category] || CAT.otro;
    const tagsHTML = (p.favoriteIngredients || []).map(t => '<span class="card-tag">' + esc(t) + '</span>').join('');
    return `<div class="place-card" style="animation-delay:${i * 60}ms">
      <div class="card-strip strip-${esc(p.category)}"></div>
      <div class="card-body">
        <div class="card-top">
          <div><div class="card-name">${esc(p.name)}</div><div class="card-restaurant">📍 ${esc(p.restaurant)}</div></div>
          <span class="card-badge ${cat.badge}">${cat.emoji} ${cat.label}</span>
        </div>
        <div class="card-stars">${starsHTML(p.rating)}</div>
        ${p.notes ? `<p class="card-notes">${esc(p.notes)}</p>` : ''}
        ${tagsHTML ? `<div class="card-tags">${tagsHTML}</div>` : ''}
      </div>
      <div class="card-footer">
        <span class="card-date">${fmtDate(p.dateAdded)}</span>
        <div class="card-btns">
          <button class="icon-btn" onclick="openEditModal('${p.id}')"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button>
          <button class="icon-btn danger" onclick="deletePlace('${p.id}')"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function applyFilters() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  const filtered = places.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.restaurant.toLowerCase().includes(q);
    const matchC = !activeCategory || p.category === activeCategory;
    return matchQ && matchC;
  });
  renderGrid(filtered);
  updateStats(filtered);
}

function updateStats(list) {
  const total = list.length;
  const avg = total ? (list.reduce((s,p) => s + (p.rating||0), 0) / total).toFixed(1) : '—';
  const counts = {};
  list.forEach(p => counts[p.category] = (counts[p.category]||0)+1);
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
  const topLabel = top ? (CAT[top[0]]?.emoji + ' ' + CAT[top[0]]?.label) : '—';
  animateNum('stat-total', total);
  document.getElementById('stat-avg').textContent = avg === '—' ? '—' : avg + ' ⭐';
  document.getElementById('stat-top').textContent = topLabel;
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  const dur = 400;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = Math.round(start + diff * p);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function openModal() {
  editingId = null; currentTags = [];
  document.getElementById('modal-title').textContent = 'Nuevo lugar';
  document.getElementById('place-form').reset();
  document.getElementById('place-id').value = '';
  setStars(3); renderTagList();
  const scrim = document.getElementById('modal-scrim');
  const card = document.getElementById('modal-card');
  scrim.classList.remove('closing'); card.classList.remove('closing');
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('field-name').focus(), 100);
}

function openEditModal(id) {
  const p = places.find(x => x.id === id);
  if (!p) return;
  editingId = id; currentTags = [...(p.favoriteIngredients || [])];
  document.getElementById('modal-title').textContent = 'Editar lugar';
  document.getElementById('place-id').value = p.id;
  document.getElementById('field-name').value = p.name;
  document.getElementById('field-restaurant').value = p.restaurant;
  document.getElementById('field-category').value = p.category;
  document.getElementById('field-notes').value = p.notes || '';
  setStars(p.rating || 3); renderTagList();
  const scrim = document.getElementById('modal-scrim');
  const card = document.getElementById('modal-card');
  scrim.classList.remove('closing'); card.classList.remove('closing');
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  const scrim = document.getElementById('modal-scrim');
  const card = document.getElementById('modal-card');
  scrim.classList.add('closing'); card.classList.add('closing');
  setTimeout(() => {
    document.getElementById('modal').classList.add('hidden');
    scrim.classList.remove('closing'); card.classList.remove('closing');
  }, 300);
}

function setStars(n) {
  document.getElementById('field-rating').value = n;
  document.querySelectorAll('#star-picker .star').forEach((s, i) => s.classList.toggle('lit', i < n));
}

document.getElementById('star-picker').addEventListener('click', e => {
  const btn = e.target.closest('.star');
  if (btn) setStars(parseInt(btn.dataset.val));
});
document.getElementById('star-picker').addEventListener('mouseover', e => {
  const btn = e.target.closest('.star');
  if (!btn) return;
  const n = parseInt(btn.dataset.val);
  document.querySelectorAll('#star-picker .star').forEach((s,i) => { s.style.color = i < n ? '#FFB400' : ''; });
});
document.getElementById('star-picker').addEventListener('mouseleave', () => {
  setStars(parseInt(document.getElementById('field-rating').value));
});

function renderTagList() {
  const list = document.getElementById('tag-list');
  list.innerHTML = currentTags.map((t, i) =>
    '<span class="tag-pill">' + esc(t) + '<span class="tag-remove" data-i="' + i + '">×</span></span>'
  ).join('');
  list.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => { currentTags.splice(parseInt(btn.dataset.i), 1); renderTagList(); });
  });
}

document.getElementById('tag-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = e.target.value.trim();
    if (v && !currentTags.includes(v) && currentTags.length < 10) { currentTags.push(v); renderTagList(); }
    e.target.value = '';
  }
});
document.getElementById('tag-box').addEventListener('click', () => document.getElementById('tag-input').focus());

document.getElementById('place-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = 'Guardando…';
  const entry = {
    id: editingId || crypto.randomUUID(),
    name: document.getElementById('field-name').value.trim(),
    restaurant: document.getElementById('field-restaurant').value.trim(),
    category: document.getElementById('field-category').value,
    rating: parseInt(document.getElementById('field-rating').value) || 3,
    notes: document.getElementById('field-notes').value.trim(),
    favoriteIngredients: [...currentTags],
    dateAdded: editingId ? (places.find(p => p.id === editingId)?.dateAdded || new Date().toISOString()) : new Date().toISOString()
  };
  if (editingId) { places = places.map(p => p.id === editingId ? entry : p); } else { places.unshift(entry); }
  try {
    await savePlaces(); closeModal(); applyFilters();
    showToast(editingId ? '✓ Lugar actualizado' : '🎉 Lugar añadido');
  } catch (err) {
    showToast('Error al guardar. Inténtalo de nuevo.');
  } finally { btn.disabled = false; btn.textContent = 'Guardar'; }
});

async function deletePlace(id) {
  if (!confirm('¿Eliminar este lugar?')) return;
  const prev = [...places];
  places = places.filter(p => p.id !== id);
  try { await savePlaces(); applyFilters(); showToast('Lugar eliminado'); }
  catch (err) { places = prev; showToast('Error al eliminar'); }
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden', 'hiding');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('hiding');
    setTimeout(() => el.classList.add('hidden'), 300);
  }, 3000);
}

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCategory = chip.dataset.cat;
    applyFilters();
  });
});

document.getElementById('search').addEventListener('input', applyFilters);
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

document.getElementById('btn-nuevo').addEventListener('click', openModal);
document.getElementById('btn-close').addEventListener('click', closeModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.getElementById('modal-scrim').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

(async () => { await fetchPlaces(); applyFilters(); })();
