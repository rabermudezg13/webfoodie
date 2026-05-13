// ==========================================
// FOODIE app.js — Apple-style web app
// Database: JSONBin.io | Map: Mapbox GL JS
// ==========================================

const JSONBIN_API_KEY = '$2a$10$vn9zCHL4XfO2iTu60MmURunpFsyukhGYuC4.BNkskFjP95GLR.2IO';
const JSONBIN_BIN_ID  = '6a0326d9250b1311c33c00da';
const MAPBOX_TOKEN    = 'pk.eyJ1IjoicmFiZXJtdWRlemcxMyIsImEiOiJjbXAzemo3YXUwdG9iMnFvc2FxNDExdGhsIn0.QR3UKxj63V1s8CPAkzZ4ow';
const API_URL         = 'https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID;

let places = []; let currentTags = []; let editingId = null;
let activeCategory = ''; let modalMap = null; let modalMarker = null; let geocoder = null;

mapboxgl.accessToken = MAPBOX_TOKEN;

function isConfigured() {
    return JSONBIN_API_KEY !== 'TU_API_KEY_AQUI' && JSONBIN_BIN_ID !== 'TU_BIN_ID_AQUI';
}

async function fetchPlaces() {
    if (!isConfigured()) { showLoader(false); document.getElementById('state-setup').classList.remove('hidden'); return; }
    showLoader(true);
    try {
          const res = await fetch(API_URL + '/latest', { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
          const data = await res.json();
          places = data.record.places || [];
          renderGrid(); updateStats();
    } catch(e) { showToast('Error loading data','error'); }
    finally { showLoader(false); }
}

async function savePlaces() {
    await fetch(API_URL, {
          method: 'PUT',
          headers: { 'Content-Type':'application/json', 'X-Master-Key': JSONBIN_API_KEY },
          body: JSON.stringify({ places })
    });
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function starsHTML(r) {
    return Array.from({length:5},(_,i)=>`<span style="color:${i<r?'#FF9500':'#ccc'};font-size:1rem;">★</span>`).join('');
}

function priceLabel(p) {
    const map = { budget:'$ Budget', moderate:'$$ Moderate', expensive:'$$$ Pricey', luxury:'$$$$ Luxury' };
    return map[p] || '';
}

function fmtDate(d) { return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }

function showLoader(v) { document.getElementById('loader').classList.toggle('hidden',!v); }

function renderGrid() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = places.filter(p =>
          (!activeCategory || p.category === activeCategory) &&
          (!q || p.name.toLowerCase().includes(q) || (p.restaurant||'').toLowerCase().includes(q) || (p.address||'').toLowerCase().includes(q))
                                     );
    const grid = document.getElementById('places-grid');
    document.getElementById('state-empty').classList.toggle('hidden', filtered.length > 0);
    if (!filtered.length) { grid.innerHTML=''; return; }
    grid.innerHTML = filtered.map((p,i) => {
          const realIdx = places.indexOf(p);
          const hasCoords = p.lat && p.lng;
          return `<div class="place-card" data-idx="${realIdx}">
                <div class="card-category-strip cat-${esc(p.category)}"></div>
                      <div class="card-body">
                              <div class="card-header-row">
                                        <div>
                                                    <div class="card-name">${esc(p.name)}</div>
                                                                <div class="card-restaurant">${esc(p.restaurant||'')}</div>
                                                                          </div>
                                                                                    <div class="card-actions">
                                                                                                <button class="btn-icon edit-btn" data-idx="${realIdx}" title="Edit">✏️</button>
                                                                                                            <button class="btn-icon delete-btn" data-idx="${realIdx}" title="Delete">🗑️</button>
                                                                                                                      </div>
                                                                                                                              </div>
                                                                                                                                      <div class="card-meta">
                                                                                                                                                <span class="card-category">${esc(p.category||'')}</span>
                                                                                                                                                          ${p.price ? `<span class="price-badge">${esc(priceLabel(p.price))}</span>` : ''}
                                                                                                                                                                  </div>
                                                                                                                                                                          <div class="card-stars">${starsHTML(p.rating||0)}</div>
                                                                                                                                                                                  ${p.notes ? `<div class="card-notes">${esc(p.notes)}</div>` : ''}
                                                                                                                                                                                          ${p.tags && p.tags.length ? `<div class="card-tags">${p.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
                                                                                                                                                                                                  ${p.address ? `<div class="card-address">📍 ${esc(p.address)}</div>` : ''}
                                                                                                                                                                                                          ${hasCoords ? `<div class="card-map" id="map-card-${realIdx}"></div>
                                                                                                                                                                                                                    <a class="gmaps-link" href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank">Open in Google Maps ↗</a>` : ''}
                                                                                                                                                                                                                            <div class="card-date">${fmtDate(p.date)}</div>
                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                      </div>`;
    }).join('');

  // Render mini maps
  filtered.forEach(p => {
        const realIdx = places.indexOf(p);
        if (!p.lat || !p.lng) return;
        const el = document.getElementById('map-card-' + realIdx);
        if (!el || el._mbDone) return;
        el._mbDone = true;
        requestAnimationFrame(() => {
                const m = new mapboxgl.Map({ container: el, style:'mapbox://styles/mapbox/streets-v12', center:[p.lng,p.lat], zoom:14, interactive:false, attributionControl:false });
                new mapboxgl.Marker({color:'#FF3B30'}).setLngLat([p.lng,p.lat]).addTo(m);
        });
  });

  // Event delegation for card buttons
  grid.onclick = e => {
        const editBtn = e.target.closest('.edit-btn');
        const delBtn  = e.target.closest('.delete-btn');
        if (editBtn) { const idx = parseInt(editBtn.dataset.idx); openEditModal(idx); }
        if (delBtn)  { const idx = parseInt(delBtn.dataset.idx);  deletePlace(idx); }
  };
}

function applyFilters() { renderGrid(); }

function updateStats() {
    document.getElementById('stat-total').textContent = places.length;
    const avg = places.length ? (places.reduce((s,p)=>s+(p.rating||0),0)/places.length).toFixed(1) : '—';
    document.getElementById('stat-avg').textContent = avg;
    const cats = {}; places.forEach(p=>{ cats[p.category]=(cats[p.category]||0)+1; });
    const top = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
    animateNum('stat-total', places.length);
    document.getElementById('stat-top').textContent = top ? top[0] : '—';
}

function animateNum(id, target) {
    const el = document.getElementById(id); let n=0;
    const step = () => { n = Math.min(n+1, target); el.textContent=n; if(n<target) requestAnimationFrame(step); };
    requestAnimationFrame(step);
}

// ── Mapbox Geocoder ──────────────────────────────
function mountGeocoder() {
    if (geocoder) return;
    geocoder = new MapboxGeocoder({ accessToken: MAPBOX_TOKEN, mapboxgl, placeholder:'Search location…', marker:false });
    geocoder.addTo(document.getElementById('geocoder-container'));
    geocoder.on('result', e => {
          const [lng, lat] = e.result.center;
          const addr = e.result.place_name;
          document.getElementById('place-address').value = addr;
          document.getElementById('place-lat').value = lat;
          document.getElementById('place-lng').value = lng;
          if (modalMap) { modalMap.flyTo({center:[lng,lat],zoom:15}); modalMarker.setLngLat([lng,lat]); }
    });
    geocoder.on('clear', () => {
          document.getElementById('place-address').value = '';
          document.getElementById('place-lat').value = '';
          document.getElementById('place-lng').value = '';
    });
}

function destroyGeocoder() {
    if (!geocoder) return;
    geocoder.onRemove(); geocoder = null;
    const c = document.getElementById('geocoder-container'); c.innerHTML='';
}

function initModalMap(lat, lng) {
    if (modalMap) return;
    const center = (lat && lng) ? [lng, lat] : [-74.006, 40.7128];
    modalMap = new mapboxgl.Map({ container:'modal-map', style:'mapbox://styles/mapbox/streets-v12', center, zoom:13 });
    modalMarker = new mapboxgl.Marker({color:'#FF3B30', draggable:true}).setLngLat(center).addTo(modalMap);
    modalMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
    modalMarker.on('dragend', () => {
          const {lng:lo, lat:la} = modalMarker.getLngLat();
          document.getElementById('place-lat').value = la.toFixed(6);
          document.getElementById('place-lng').value = lo.toFixed(6);
    });
    if (lat && lng) {
          document.getElementById('place-lat').value = lat;
          document.getElementById('place-lng').value = lng;
    }
}

function resetModalMap() {
    if (modalMap) { modalMap.remove(); modalMap=null; modalMarker=null; }
}

// ── Modal ────────────────────────────────────────
function openModal() {
    editingId=null; currentTags=[];
    document.getElementById('modal-title').textContent='Add Place';
    document.getElementById('place-name').value='';
    document.getElementById('place-restaurant').value='';
    document.getElementById('place-category').value='Restaurant';
    document.getElementById('place-notes').value='';
    document.getElementById('place-address').value='';
    document.getElementById('place-lat').value='';
    document.getElementById('place-lng').value='';
    document.getElementById('tag-input').value='';
    document.querySelectorAll('.star-btn').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.price-btn').forEach(b=>b.classList.remove('active'));
    renderTagList();
    showModal();
    setTimeout(()=>{ mountGeocoder(); initModalMap(null,null); },100);
}

function openEditModal(idx) {
    const p = places[idx]; editingId=idx; currentTags=[...(p.tags||[])];
    document.getElementById('modal-title').textContent='Edit Place';
    document.getElementById('place-name').value=p.name||'';
    document.getElementById('place-restaurant').value=p.restaurant||'';
    document.getElementById('place-category').value=p.category||'Restaurant';
    document.getElementById('place-notes').value=p.notes||'';
    document.getElementById('place-address').value=p.address||'';
    document.getElementById('place-lat').value=p.lat||'';
    document.getElementById('place-lng').value=p.lng||'';
    document.getElementById('tag-input').value='';
    // Set stars
  document.querySelectorAll('.star-btn').forEach(s=>{ s.classList.toggle('active', parseInt(s.dataset.value)<=(p.rating||0)); });
    // Set price
  document.querySelectorAll('.price-btn').forEach(b=>{ b.classList.toggle('active', b.dataset.value===(p.price||'')); });
    renderTagList();
    showModal();
    setTimeout(()=>{ mountGeocoder(); initModalMap(p.lat,p.lng); if(p.address && geocoder) geocoder.setInput(p.address); },100);
}

function showModal() {
    document.getElementById('place-modal').classList.remove('hidden');
    document.body.style.overflow='hidden';
}

function closeModal() {
    document.getElementById('place-modal').classList.add('hidden');
    document.body.style.overflow='';
    destroyGeocoder(); resetModalMap();
}

// ── Stars ────────────────────────────────────────
function setStars(val) {
    document.querySelectorAll('.star-btn').forEach(s => {
          s.classList.toggle('active', parseInt(s.dataset.value) <= val);
    });
}

// ── Tags ─────────────────────────────────────────
function renderTagList() {
    document.getElementById('tag-list').innerHTML = currentTags.map((t,i)=>
          `<span class="tag">${esc(t)} <button onclick="removeTag(${i})">×</button></span>`).join('');
}
function removeTag(i) { currentTags.splice(i,1); renderTagList(); }

// ── Delete ───────────────────────────────────────
async function deletePlace(idx) {
    if (!confirm('Delete this place?')) return;
    places.splice(idx,1);
    await savePlaces(); renderGrid(); updateStats();
    showToast('Deleted','success');
}

// ── Toast ────────────────────────────────────────
function showToast(msg, type='success') {
    const t = document.getElementById('toast');
    t.textContent=msg; t.className='toast '+type; t.classList.remove('hidden');
    setTimeout(()=>t.classList.add('hidden'),3000);
}

// ── DOM Ready ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    fetchPlaces();

                            // Category chips
                            document.querySelectorAll('.chip').forEach(c => {
                                  c.addEventListener('click', () => {
                                          document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
                                          c.classList.add('active');
                                          activeCategory = c.dataset.cat || '';
                                          renderGrid();
                                  });
                            });

                            // Search
                            document.getElementById('search-input').addEventListener('input', applyFilters);

                            // Add button
                            document.getElementById('add-btn').addEventListener('click', openModal);

                            // Modal close
                            document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('place-modal').addEventListener('click', e => { if(e.target===e.currentTarget) closeModal(); });

                            // Stars — click to set rating
                            document.querySelectorAll('.star-btn').forEach(btn => {
                                  btn.addEventListener('click', () => setStars(parseInt(btn.dataset.value)));
                                  btn.addEventListener('mouseenter', () => {
                                          const val = parseInt(btn.dataset.value);
                                          document.querySelectorAll('.star-btn').forEach(s => {
                                                    s.classList.toggle('hover', parseInt(s.dataset.value) <= val);
                                          });
                                  });
                                  btn.addEventListener('mouseleave', () => {
                                          document.querySelectorAll('.star-btn').forEach(s => s.classList.remove('hover'));
                                  });
                            });

                            // Price buttons
                            document.querySelectorAll('.price-btn').forEach(btn => {
                                  btn.addEventListener('click', () => {
                                          document.querySelectorAll('.price-btn').forEach(b=>b.classList.remove('active'));
                                          btn.classList.add('active');
                                  });
                            });

                            // Tag input
                            document.getElementById('tag-input').addEventListener('keydown', e => {
                                  if (e.key==='Enter' || e.key===',') {
                                          e.preventDefault();
                                          const v = e.target.value.trim().replace(/,$/,'');
                                          if (v && !currentTags.includes(v)) { currentTags.push(v); renderTagList(); }
                                          e.target.value='';
                                  }
                            });

                            // Save form
                            document.getElementById('place-form').addEventListener('submit', async e => {
                                  e.preventDefault();
                                  const name = document.getElementById('place-name').value.trim();
                                  if (!name) { showToast('Name is required','error'); return; }
                                  const rating = document.querySelectorAll('.star-btn.active').length;
                                  const price = document.querySelector('.price-btn.active')?.dataset.value || '';
                                  const place = {
                                          id: editingId !== null ? places[editingId].id : Date.now(),
                                          name,
                                          restaurant: document.getElementById('place-restaurant').value.trim(),
                                          category: document.getElementById('place-category').value,
                                          rating,
                                          price,
                                          notes: document.getElementById('place-notes').value.trim(),
                                          address: document.getElementById('place-address').value.trim(),
                                          lat: parseFloat(document.getElementById('place-lat').value)||null,
                                          lng: parseFloat(document.getElementById('place-lng').value)||null,
                                          tags: [...currentTags],
                                          date: editingId !== null ? places[editingId].date : new Date().toISOString()
                                  };
                                  if (editingId !== null) { places[editingId]=place; } else { places.unshift(place); }
                                  await savePlaces(); closeModal(); renderGrid(); updateStats();
                                  showToast(editingId !== null ? 'Updated!' : 'Added!', 'success');
                            });
});
