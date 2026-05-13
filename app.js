// ============================================
// FOODIE app.js — Apple-style web app
// Database: JSONBin.io | Map: Mapbox GL JS
// ============================================

const JSONBIN_API_KEY = '$2a$10$vn9zCHL4XfO2iTu60MmURunpFsyukhGYuC4.BNkskFjP95GLR.2IO';
const JSONBIN_BIN_ID  = '6a0326d9250b1311c33c00da';
const MAPBOX_TOKEN    = 'pk.eyJ1IjoicmFiZXJtdWRlemcxMyIsImEiOiJjbXAzemo3YXUwdG9iMnFvc2FxNDExdGhsIn0.vvkOj-q_9rDS7IpcG0bC3g';
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
    if (!res.ok) throw new Error('HTTP ' + res.status);
    places = (await res.json()).record?.places || [];
  } catch(e) { console.error(e); showToast('Could not connect.'); places = []; }
  finally { showLoader(false); }
}

async function savePlaces() {
  const res = await fetch(API_URL, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
    body: JSON.stringify({ places })
  });
  if (!res.ok) throw new Error('Save error: ' + res.status);
}

const CAT = {
  entrada:{label:'Starter',emoji:'🥗',badge:'badge-entrada'},
  platoPrincipal:{label:'Main course',emoji:'🍽',badge:'badge-platoPrincipal'},
  postre:{label:'Dessert',emoji:'🎂',badge:'badge-postre'},
  bebida:{label:'Drink',emoji:'☕',badge:'badge-bebida'},
  snack:{label:'Snack',emoji:'🍿',badge:'badge-snack'},
  otro:{label:'Other',emoji:'✦',badge:'badge-otro'}
};

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function starsHTML(n){let h='';for(let i=1;i<=5;i++)h+=`<span style="color:${i<=n?'#FFB400':'#E5E5EA'}">★</span>`;return h;}
function fmtDate(iso){return new Date(iso).toLocaleDateString('en-US',{day:'2-digit',month:'short',year:'numeric'});}
function showLoader(show){const el=document.getElementById('state-loader');if(el)el.classList.toggle('hidden',!show);}

function renderGrid(list) {
  const grid=document.getElementById('places-grid'),empty=document.getElementById('state-empty'),setup=document.getElementById('state-setup');
  if(!isConfigured())return;
  if(!list.length){grid.innerHTML='';empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');if(setup)setup.classList.add('hidden');
  grid.innerHTML=list.map((p,i)=>{
    const cat=CAT[p.category]||CAT.otro;
    const tagsHTML=(p.favoriteIngredients||[]).map(t=>`<span class="card-tag">${esc(t)}</span>`).join('');
    const mapHTML=(p.lat&&p.lng)?
      `<div class="card-map-wrap">
        <div class="card-map" id="cardmap-${p.id}" data-lat="${p.lat}" data-lng="${p.lng}"></div>
        <a class="card-map-link" href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" rel="noopener">Open in Google Maps ↗</a>
       </div>`:'';
    return `<div class="place-card" style="animation-delay:${i*60}ms">
<div class="card-strip strip-${esc(p.category)}"></div>
<div class="card-body">
<div class="card-top"><div><div class="card-name">${esc(p.name)}</div><div class="card-restaurant">📍 ${esc(p.restaurant)}</div></div>
<span class="card-badge ${cat.badge}">${cat.emoji} ${cat.label}</span></div>
<div class="card-stars">${starsHTML(p.rating)}</div>
${p.notes?`<p class="card-notes">${esc(p.notes)}</p>`:''}
${tagsHTML?`<div class="card-tags">${tagsHTML}</div>`:''}
${p.address?`<div class="card-address"><svg width="11" height="13" viewBox="0 0 11 13" fill="none"><path d="M5.5 1C3.01 1 1 3.01 1 5.5c0 3.375 4.5 7.5 4.5 7.5s4.5-4.125 4.5-7.5C10 3.01 7.99 1 5.5 1z" stroke="#8E8E93" stroke-width="1.2"/><circle cx="5.5" cy="5.5" r="1.5" stroke="#8E8E93" stroke-width="1.2"/></svg>${esc(p.address)}</div>`:''}
${mapHTML}
</div>
<div class="card-footer"><span class="card-date">${fmtDate(p.dateAdded)}</span>
<div class="card-btns">
<button class="icon-btn" title="Edit" onclick="openEditModal('${p.id}')"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button>
<button class="icon-btn danger" title="Delete" onclick="deletePlace('${p.id}')"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</div></div></div>`;
  }).join('');
  requestAnimationFrame(()=>{
    list.forEach(p=>{
      if(!p.lat||!p.lng)return;
      const el=document.getElementById('cardmap-'+p.id);
      if(!el||el._mbDone)return; el._mbDone=true;
      const m=new mapboxgl.Map({container:el,style:'mapbox://styles/mapbox/streets-v12',center:[p.lng,p.lat],zoom:14,interactive:false,attributionControl:false});
      new mapboxgl.Marker({color:'#FF6B35'}).setLngLat([p.lng,p.lat]).addTo(m);
    });
  });
}

function applyFilters(){
  const q=document.getElementById('search').value.toLowerCase();
  let list=activeCategory?places.filter(p=>p.category===activeCategory):places;
  if(q) list=list.filter(p=>p.name.toLowerCase().includes(q)||p.restaurant.toLowerCase().includes(q));
  renderGrid(list);updateStats();
}

function updateStats(){
  const total=places.length,avg=total?(places.reduce((a,p)=>a+p.rating,0)/total).toFixed(1):null;
  const counts={};places.forEach(p=>{counts[p.category]=(counts[p.category]||0)+1;});
  const topKey=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  animateNum('stat-total',total);
  document.getElementById('stat-avg').textContent=avg?avg+' ★':'—';
  document.getElementById('stat-top').textContent=topKey?CAT[topKey]?.emoji+' '+CAT[topKey]?.label:'—';
}

function animateNum(id,to){
  const el=document.getElementById(id),from=parseInt(el.textContent)||0,dur=400,start=performance.now();
  function step(ts){const p=Math.min((ts-start)/dur,1);el.textContent=Math.round(from+(to-from)*p);if(p<1)requestAnimationFrame(step);}
  requestAnimationFrame(step);
}

function mountGeocoder(){
  const c=document.getElementById('geocoder-container');if(!c)return;c.innerHTML='';
  geocoder=new MapboxGeocoder({accessToken:MAPBOX_TOKEN,mapboxgl,placeholder:'Search address or place…',language:'en',limit:5,flyTo:false});
  geocoder.addTo('#geocoder-container');
  geocoder.on('result',e=>{
    const[lng,lat]=e.result.center;
    document.getElementById('field-lat').value=lat;
    document.getElementById('field-lng').value=lng;
    document.getElementById('field-address').value=e.result.place_name.split(',').slice(0,3).join(',');
    initModalMap(lat,lng);
  });
  geocoder.on('clear',()=>{
    ['field-lat','field-lng','field-address'].forEach(id=>document.getElementById(id).value='');
    resetModalMap();
  });
}

function destroyGeocoder(){
  if(geocoder){try{geocoder.onRemove();}catch(e){}geocoder=null;}
  const c=document.getElementById('geocoder-container');if(c)c.innerHTML='';
}

function initModalMap(lat,lng){
  const el=document.getElementById('modal-map');el.classList.remove('hidden');
  if(modalMap){modalMap.flyTo({center:[lng,lat],zoom:15,speed:1.2});if(modalMarker)modalMarker.setLngLat([lng,lat]);return;}
  modalMap=new mapboxgl.Map({container:'modal-map',style:'mapbox://styles/mapbox/streets-v12',center:[lng,lat],zoom:15,attributionControl:false});
  modalMap.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
  const markerEl=document.createElement('div');
  markerEl.className='custom-marker';
  markerEl.innerHTML='<div class="marker-pin"></div><div class="marker-pulse"></div>';
  modalMarker=new mapboxgl.Marker({element:markerEl,draggable:true}).setLngLat([lng,lat]).addTo(modalMap);
  modalMarker.on('dragend',()=>{const ll=modalMarker.getLngLat();document.getElementById('field-lat').value=ll.lat;document.getElementById('field-lng').value=ll.lng;});
  setTimeout(()=>modalMap.resize(),100);
}

function resetModalMap(){document.getElementById('modal-map').classList.add('hidden');if(modalMap){modalMap.remove();modalMap=null;modalMarker=null;}}

function openModal(){
  editingId=null;currentTags=[];
  document.getElementById('modal-title').textContent='New place';
  document.getElementById('place-form').reset();
  ['place-id','field-lat','field-lng','field-address'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('field-rating').value=3;
  renderTagList();setStars(3);resetModalMap();destroyGeocoder();
  showModal();setTimeout(mountGeocoder,50);
}

function openEditModal(id){
  const p=places.find(x=>x.id===id);if(!p)return;
  editingId=id;currentTags=[...(p.favoriteIngredients||[])];
  document.getElementById('modal-title').textContent='Edit place';
  document.getElementById('place-id').value=p.id;
  document.getElementById('field-name').value=p.name;
  document.getElementById('field-restaurant').value=p.restaurant;
  document.getElementById('field-category').value=p.category;
  document.getElementById('field-notes').value=p.notes||'';
  document.getElementById('field-rating').value=p.rating;
  document.getElementById('field-lat').value=p.lat||'';
  document.getElementById('field-lng').value=p.lng||'';
  document.getElementById('field-address').value=p.address||'';
  renderTagList();setStars(p.rating);resetModalMap();destroyGeocoder();
  showModal();setTimeout(()=>{mountGeocoder();if(p.lat&&p.lng)initModalMap(p.lat,p.lng);},50);
}

function showModal(){
  document.getElementById('modal').classList.remove('hidden');
  requestAnimationFrame(()=>{document.getElementById('modal-card').classList.add('open');document.getElementById('modal-scrim').classList.add('open');});
  setTimeout(()=>document.getElementById('field-name').focus(),350);
}

function closeModal(){
  document.getElementById('modal-card').classList.remove('open');
  document.getElementById('modal-scrim').classList.remove('open');
  setTimeout(()=>{document.getElementById('modal').classList.add('hidden');resetModalMap();destroyGeocoder();},320);
}

function setStars(n){document.querySelectorAll('#star-picker .star').forEach(s=>s.classList.toggle('active',parseInt(s.dataset.v)<=n));}

function renderTagList(){
  document.getElementById('tag-list').innerHTML=currentTags
    .map((t,i)=>`<span class="tag-chip">${esc(t)}<button type="button" onclick="removeTag(${i})">×</button></span>`).join('');
}

function removeTag(i){currentTags.splice(i,1);renderTagList();}

async function deletePlace(id){
  if(!confirm('Delete this place?'))return;
  places=places.filter(p=>p.id!==id);
  try{await savePlaces();renderGrid(places);updateStats();showToast('Deleted.');}
  catch(e){showToast('Error deleting.');}
}

let _toastTimer;
function showToast(msg){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.remove('hidden');
  clearTimeout(_toastTimer);_toastTimer=setTimeout(()=>t.classList.add('hidden'),3000);
}

document.addEventListener('DOMContentLoaded',async()=>{
  await fetchPlaces();renderGrid(places);updateStats();
  document.getElementById('btn-nuevo').addEventListener('click',openModal);
  document.getElementById('btn-close').addEventListener('click',closeModal);
  document.getElementById('btn-cancel').addEventListener('click',closeModal);
  document.getElementById('modal-scrim').addEventListener('click',closeModal);
  document.querySelectorAll('#star-picker .star').forEach(s=>{
    s.addEventListener('click',()=>{const v=parseInt(s.dataset.v);document.getElementById('field-rating').value=v;setStars(v);});
  });
  document.getElementById('field-tags').addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;e.preventDefault();
    const val=e.target.value.trim();
    if(val&&!currentTags.includes(val)){currentTags.push(val);renderTagList();}
    e.target.value='';
  });
  document.getElementById('search').addEventListener('input',applyFilters);
  document.querySelectorAll('.chip').forEach(c=>{
    c.addEventListener('click',()=>{
      document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');activeCategory=c.dataset.cat;applyFilters();
    });
  });
  window.addEventListener('scroll',()=>document.getElementById('navbar').classList.toggle('scrolled',window.scrollY>10));
  document.getElementById('place-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=document.getElementById('field-name').value.trim(),restaurant=document.getElementById('field-restaurant').value.trim();
    if(!name||!restaurant){showToast('Name and restaurant are required.');return;}
    const latVal=document.getElementById('field-lat').value,lngVal=document.getElementById('field-lng').value;
    const place={
      id:editingId||Date.now().toString(36)+Math.random().toString(36).slice(2),
      name,restaurant,
      category:document.getElementById('field-category').value,
      rating:parseInt(document.getElementById('field-rating').value),
      notes:document.getElementById('field-notes').value.trim(),
      favoriteIngredients:[...currentTags],
      address:document.getElementById('field-address').value.trim(),
      lat:latVal?parseFloat(latVal):null,
      lng:lngVal?parseFloat(lngVal):null,
      dateAdded:editingId?places.find(p=>p.id===editingId)?.dateAdded:new Date().toISOString()
    };
    if(editingId)places=places.map(p=>p.id===editingId?place:p);
    else places.unshift(place);
    const btn=document.getElementById('btn-save');btn.disabled=true;btn.textContent='Saving…';
    try{await savePlaces();renderGrid(places);updateStats();closeModal();showToast(editingId?'Updated!':'Place saved!');}
    catch(err){showToast('Error saving. Try again.');}
    finally{btn.disabled=false;btn.textContent='Save';}
  });
});
