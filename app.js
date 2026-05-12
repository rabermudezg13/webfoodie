// ============================================
// FOODIE app.js — Apple-style web app
// Database: JSONBin.io | Map: Leaflet + OSM
// ============================================

const JSONBIN_API_KEY = '$2a$10$vn9zCHL4XfO2iTu60MmURunpFsyukhGYuC4.BNkskFjP95GLR.2IO';
const JSONBIN_BIN_ID = '6a0326d9250b1311c33c00da';
const API_URL = 'https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID;

let places = [];
let currentTags = [];
let editingId = null;
let activeCategory = '';
let modalMap = null;
let modalMarker = null;
let _geoResults = [];

// ============================================
// SETUP CHECK
// ============================================
function isConfigured() {
  return JSONBIN_API_KEY !== 'TU_API_KEY_AQUI' && JSONBIN_BIN_ID !== 'TU_BIN_ID_AQUI';
}

// ============================================
// API
// ============================================
async function fetchPlaces() {
  if (!isConfigured()) {
    showLoader(false);
    document.getElementById('state-setup').classList.remove('hidden');
    return;
  }
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
    showToast('Could not connect. Check your API Key and Bin ID.');
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
  if (!res.ok) throw new Error('Save error: ' + res.status);
}

// ============================================
// UTILITIES
// ============================================
const CAT = {
  entrada:       { label: 'Starter',     emoji: '🥗', badge: 'badge-entrada' },
  platoPrincipal:{ label: 'Main course', emoji: '🍽', badge: 'badge-platoPrincipal' },
  postre:        { label: 'Dessert',     emoji: '🎂', badge: 'badge-postre' },
  bebida:        { label: 'Drink',       emoji: '☕', badge: 'badge-bebida' },
  snack:         { label: 'Snack',       emoji: '🍿', badge: 'badge-snack' },
  otro:          { label: 'Other',       emoji: '✦',  badge: 'badge-otro' }
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
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showLoader(show) {
  const el = document.getElementById('state-loader');
  if (el) el.classList.toggle('hidden', !show);
}

// ============================================
// RENDER GRID
// ============================================
function renderGrid(list) {
  const grid  = document.getElementById('places-grid');
  const empty = document.getElementById('state-empty');
  const setup = document.getElementById('state-setup');
  if (!isConfigured()) return;
  if (!list.length) { grid.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  if (setup) setup.classList.add('hidden');
  grid.innerHTML = list.map((p, i) => {
    const cat = CAT[p.category] || CAT.otro;
    const tagsHTML = (p.favoriteIngredients || []).map(t => '<span class="card-tag">' + esc(t) + '</span>').join('');
    const mapHTML = (p.lat && p.lng)
      ? `<div class="card-map-wrap"><div class="card-map" id="map-${p.id}" data-lat="${p.lat}" data-lng="${p.lng}"></div><a class="card-map-link" href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}" target="_blank" rel="noopener">Open in maps ↗</a></div>`
      : '';
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
    ${p.address ? `<div class="card-address"><svg width="11" height="13" viewBox="0 0 11 13" fill="none"><path d="M5.5 1C3.01 1 1 3.01 1 5.5c0 3.375 4.5 7.5 4.5 7.5s4.5-4.125 4.5-7.5C10 3.01 7.99 1 5.5 1z" stroke="#8E8E93" stroke-width="1.2"/><circle cx="5.5" cy="5.5" r="1.5" stroke="#8E8E93" stroke-width="1.2"/></svg>${esc(p.address)}</div>` : ''}
    ${mapHTML}
  </div>
  <div class="card-footer">
    <span class="card-date">${fmtDate(p.dateAdded)}</span>
    <div class="card-btns">
      <button class="icon-btn" title="Edit" onclick="openEditModal('${p.id}')"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button>
      <button class="icon-btn danger" title="Delete" onclick="deletePlace('${p.id}')"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
  </div>
</div>`;
  }).join('');
  requestAnimationFrame(() => {
    list.forEach(p => {
      if (!p.lat || !p.lng) return;
      const el = document.getElementById('map-' + p.id);
      if (!el || el._leaflet_id) return;
      const m = L.map(el, { zoomControl: false, scrollWheelZoom: false, dragging: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
      m.setView([p.lat, p.lng], 15);
      L.marker([p.lat, p.lng]).addTo(m);
    });
  });
}

// ============================================
// FILTERS & STATS
// ============================================
function applyFilters() {
  const q = document.getElementById('search').value.toLowerCase();
  let list = places;
  if (activeCategory) list = list.filter(p => p.category === activeCategory);
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.restaurant.toLowerCase().includes(q));
  renderGrid(list);
  updateStats();
}

function updateStats() {
  const total = places.length;
  const avg = total ? (places.reduce((a,p) => a + p.rating, 0) / total).toFixed(1) : null;
  const counts = {};
  places.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const topKey = Object.keys(counts).sort((a,b) => counts[b]-counts[a])[0];
  const top = topKey ? (CAT[topKey]?.emoji + ' ' + CAT[topKey]?.label) : '—';
  animateNum('stat-total', total);
  document.getElementById('stat-avg').textContent = avg ? avg + ' ★' : '—';
  document.getElementById('stat-top').textContent = top;
}

function animateNum(id, to) {
  const el = document.getElementById(id);
  const from = parseInt(el.textContent) || 0;
  const dur = 400; const start = performance.now();
  function step(ts) {
    const p = Math.min((ts - start) / dur, 1);
    el.textContent = Math.round(from + (to - from) * p);
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
  document.getElementById('modal-title').textContent = 'New place';
  document.getElementById('place-form').reset();
  document.getElementById('place-id').value = '';
  document.getElementById('field-rating').value = 3;
  document.getElementById('field-lat').value = '';
  document.getElementById('field-lng').value = '';
  document.getElementById('field-address').value = '';
  document.getElementById('loc-suggestions').classList.add('hidden');
  _geoResults = [];
  renderTagList();
  setStars(3);
  resetModalMap();
  showModal();
}

function openEditModal(id) {
  const p = places.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  currentTags = [...(p.favoriteIngredients || [])];
  document.getElementById('modal-title').textContent = 'Edit place';
  document.getElementById('place-id').value = p.id;
  document.getElementById('field-name').value = p.name;
  document.getElementById('field-restaurant').value = p.restaurant;
  document.getElementById('field-category').value = p.category;
  document.getElementById('field-notes').value = p.notes || '';
  document.getElementById('field-rating').value = p.rating;
  document.getElementById('field-address').value = p.address || '';
  document.getElementById('field-lat').value = p.lat || '';
  document.getElementById('field-lng').value = p.lng || '';
  _geoResults = [];
  renderTagList();
  setStars(p.rating);
  resetModalMap();
  if (p.lat && p.lng) {
    setTimeout(() => initModalMap(p.lat, p.lng), 300);
  }
  showModal();
}

function showModal() {
  const shell = document.getElementById('modal');
  shell.classList.remove('hidden');
  requestAnimationFrame(() => {
    document.getElementById('modal-card').classList.add('open');
    document.getElementById('modal-scrim').classList.add('open');
  });
  document.getElementById('field-name').focus();
}

function closeModal() {
  document.getElementById('modal-card').classList.remove('open');
  document.getElementById('modal-scrim').classList.remove('open');
  setTimeout(() => document.getElementById('modal').classList.add('hidden'), 320);
  if (modalMap) { modalMap.remove(); modalMap = null; modalMarker = null; }
}

function setStars(n) {
  document.querySelectorAll('#star-picker .star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.v) <= n);
  });
}

function renderTagList() {
  const el = document.getElementById('tag-list');
  el.innerHTML = currentTags.map((t,i) =>
    `<span class="tag-chip">${esc(t)}<button type="button" onclick="removeTag(${i})">×</button></span>`
  ).join('');
}

function removeTag(i) { currentTags.splice(i, 1); renderTagList(); }

// ============================================
// LOCATION / GEOCODING
// ============================================
async function searchLocation() {
  const q = document.getElementById('field-address').value.trim();
  if (!q) return;
  const btn = document.getElementById('btn-search-loc');
  btn.disabled = true;
  btn.innerHTML = '<span class="loc-spinner"></span>';
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(q);
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    _geoResults = await res.json();
    showSuggestions(_geoResults);
  } catch(e) {
    showToast('Location search failed. Try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }
}

function showSuggestions(results) {
  const el = document.getElementById('loc-suggestions');
  if (!results.length) {
    el.innerHTML = '<div class="loc-no-results">No results found</div>';
    el.classList.remove('hidden');
    return;
  }
  el.innerHTML = results.map((r, i) =>
    `<div class="loc-item" data-idx="${i}">
      <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><path d="M5 1C2.79 1 1 2.79 1 5c0 3 4 7 4 7s4-4 4-7c0-2.21-1.79-4-4-4z" stroke="#8E8E93" stroke-width="1.2"/><circle cx="5" cy="5" r="1.5" stroke="#8E8E93" stroke-width="1.2"/></svg>
      <span>${esc(r.display_name)}</span>
    </div>`
  ).join('');
  el.classList.remove('hidden');
  // Event delegation — safe, no inline onclick with strings
  el.onclick = function(e) {
    const item = e.target.closest('.loc-item');
    if (!item) return;
    const idx = parseInt(item.dataset.idx);
    const r = _geoResults[idx];
    if (!r) return;
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    const short = r.display_name.split(',').slice(0,3).join(',');
    document.getElementById('field-lat').value = lat;
    document.getElementById('field-lng').value = lng;
    document.getElementById('field-address').value = short;
    el.classList.add('hidden');
    initModalMap(lat, lng);
  };
}

function initModalMap(lat, lng) {
  const el = document.getElementById('modal-map');
  el.classList.remove('hidden');
  if (modalMap) {
    modalMap.setView([lat, lng], 15);
    if (modalMarker) modalMarker.setLatLng([lat, lng]);
    else modalMarker = L.marker([lat, lng], { draggable: true }).addTo(modalMap);
  } else {
    modalMap = L.map(el, { zoomControl: true, scrollWheelZoom: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(modalMap);
    modalMap.setView([lat, lng], 15);
    modalMarker = L.marker([lat, lng], { draggable: true }).addTo(modalMap);
    modalMarker.on('dragend', e => {
      const ll = e.target.getLatLng();
      document.getElementById('field-lat').value = ll.lat;
      document.getElementById('field-lng').value = ll.lng;
    });
  }
  setTimeout(() => modalMap.invalidateSize(), 150);
}

function resetModalMap() {
  const el = document.getElementById('modal-map');
  el.classList.add('hidden');
  if (modalMap) { modalMap.remove(); modalMap = null; modalMarker = null; }
}

// ============================================
// CRUD
// ============================================
async function deletePlace(id) {
  if (!confirm('Delete this place?')) return;
  places = places.filter(p => p.id !== id);
  try { await savePlaces(); renderGrid(places); updateStats(); showToast('Deleted.'); }
  catch(e) { showToast('Error deleting.'); }
}

// ============================================
// TOAST
// ============================================
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await fetchPlaces();
  renderGrid(places);
  updateStats();

  document.getElementById('btn-nuevo').addEventListener('click', openModal);
  document.getElementById('btn-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-scrim').addEventListener('click', closeModal);

  document.querySelectorAll('#star-picker .star').forEach(s => {
    s.addEventListener('click', () => {
      const v = parseInt(s.dataset.v);
      document.getElementById('field-rating').value = v;
      setStars(v);
    });
  });

  document.getElementById('field-tags').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && !currentTags.includes(val)) { currentTags.push(val); renderTagList(); }
      e.target.value = '';
    }
  });

  document.getElementById('search').addEventListener('input', applyFilters);

  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      activeCategory = c.dataset.cat;
      applyFilters();
    });
  });

  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 10);
  });

  document.getElementById('btn-search-loc').addEventListener('click', searchLocation);
  document.getElementById('field-address').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); searchLocation(); }
  });

  document.getElementById('place-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('field-name').value.trim();
    const restaurant = document.getElementById('field-restaurant').value.trim();
    if (!name || !restaurant) { showToast('Name and restaurant are required.'); return; }
    const latVal = document.getElementById('field-lat').value;
    const lngVal = document.getElementById('field-lng').value;
    const place = {
      id: editingId || Date.now().toString(36) + Math.random().toString(36).slice(2),
      name, restaurant,
      category: document.getElementById('field-category').value,
      rating: parseInt(document.getElementById('field-rating').value),
      notes: document.getElementById('field-notes').value.trim(),
      favoriteIngredients: [...currentTags],
      address: document.getElementById('field-address').value.trim(),
      lat: latVal ? parseFloat(latVal) : null,
      lng: lngVal ? parseFloat(lngVal) : null,
      dateAdded: editingId ? places.find(p => p.id === editingId)?.dateAdded : new Date().toISOString()
    };
    if (editingId) places = places.map(p => p.id === editingId ? place : p);
    else places.unshift(place);
    const btn = document.getElementById('btn-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await savePlaces();
      renderGrid(places);
      updateStats();
      closeModal();
      showToast(editingId ? 'Updated!' : 'Place saved!');
    } catch(err) {
      showToast('Error saving. Try again.');
    } finally {
      btn.disabled = false; btn.textContent = 'Save';
    }
  });
});
