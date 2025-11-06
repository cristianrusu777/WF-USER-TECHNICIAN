import * as DataFetcher from "./modules/DataFetcher.js";
import { defaultIcon, goldIcon } from "./config.js";

// Auth gate for technician pages
if (localStorage.getItem('role') !== 'technician') {
  window.location = './authentication.html';
}

function regionClassName(region){
  const slug = String(region||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return `region-${slug || 'unknown'}`;
}
function loadDeletedCams(){
  try { return new Set(JSON.parse(localStorage.getItem('deletedCameras')||'[]')); } catch { return new Set(); }
}
function saveDeletedCams(set){
  localStorage.setItem('deletedCameras', JSON.stringify([...set]));
}

// Persist bookmarked cameras similar to user map
const bookmarked = new Set(JSON.parse(localStorage.getItem('bookmarkedCameras') || '[]'));
window.bookmarked = bookmarked;

// Helpers to enrich camera with technician fields (mocked)
function regionFromLatLng(lat, lng) {
  if (lat > 0 && lng < -30 && lng > -170) return "North America";
  if (lat < 15 && lng < -30 && lng > -85) return "South America";
  if (lng >= -30 && lng <= 60 && lat > 30) return "Europe";
  if (lng >= -20 && lng <= 55 && lat < 30 && lat > -40) return "Africa";
  if (lng > 55 && lng <= 180 && lat >= -10) return "Asia";
  if (lat < 0 && ((lng >= 110 && lng <= 180) || (lng <= -150))) return "Oceania";
  return "Antarctica & Misc";
}

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Metric severity helper (consistent with tech pages)
function metricClass(name, value){
  switch(name){
    case 'bitrate':
      if (value < 2) return 'metric metric-crit';
      if (value < 4) return 'metric metric-warn';
      return 'metric metric-ok';
    case 'temp':
      if (value >= 40) return 'metric metric-crit';
      if (value >= 35) return 'metric metric-warn';
      return 'metric metric-ok';
    case 'storage':
      if (value >= 90) return 'metric metric-crit';
      if (value >= 70) return 'metric metric-warn';
      return 'metric metric-ok';
    default:
      return '';
  }
}

function makeTechCamera(c) {
  const status = randomChoice(["online","online","online","degraded","offline"]);
  const bitrateMbps = +(Math.random() * 8 + 2).toFixed(1);
  const temperatureC = +(Math.random() * 25 + 10).toFixed(1);
  const storageUsed = Math.floor(Math.random() * 80) + 10; // %
  const uptimeHrs = Math.floor(Math.random() * 500) + 5;
  const lastHeartbeatMin = Math.floor(Math.random() * 15);
  const firmware = randomChoice(["v1.9.2","v2.0.0","v2.1.3","v2.2.0-rc1"]);
  const ip = `10.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}`;
  const region = regionFromLatLng(c.lat, c.lng);
  return { ...c, region, status, bitrateMbps, temperatureC, storageUsed, uptimeHrs, lastHeartbeatMin, firmware, ip };
}

const techCameras = DataFetcher.cameras.map(makeTechCamera);

// ===== Admin (beheerder) custom cameras management =====
let adminSort = { key: null, dir: 'asc' };
function loadStatusOverrides(){
  try { return JSON.parse(localStorage.getItem('statusOverrides')||'{}'); } catch { return {}; }
}
function saveStatusOverride(name, status){
  const o = loadStatusOverrides();
  o[name] = status;
  localStorage.setItem('statusOverrides', JSON.stringify(o));
}
function getDisplayStatus(c){
  const o = loadStatusOverrides();
  return o[c.name] || c.status;
}
function loadCustomCams(){
  try { return JSON.parse(localStorage.getItem('adminCustomCameras')||'[]'); } catch { return []; }
}
function saveCustomCams(list){
  localStorage.setItem('adminCustomCameras', JSON.stringify(list));
}
function addCustomCam({name, lat, lng}){
  const customs = loadCustomCams();
  if (customs.find(c=>c.name===name)) return { ok:false, msg:'Name already exists' };
  customs.push({name, lat, lng, createdAt: Date.now()});
  saveCustomCams(customs);
  // Add to runtime
  const c = makeTechCamera({ name, lat: Number(lat), lng: Number(lng) });
  c.custom = true;
  techCameras.push(c);
  // Place marker if map exists
  if (window.techMap) createMarker(c);
  renderList();
  return { ok:true };
}
function deleteCustomCam(name){
  const customs = loadCustomCams().filter(c=>c.name!==name);
  saveCustomCams(customs);
  const idx = techCameras.findIndex(c=>c.name===name && c.custom);
  if (idx>=0){
    // remove marker
    try { techCameras[idx].marker?.remove(); } catch {}
    techCameras.splice(idx,1);
  }
  renderList();
}
function updateCustomCam(name, {lat, lng}){
  const customs = loadCustomCams();
  const obj = customs.find(c=>c.name===name);
  if (!obj) return;
  obj.lat = Number(lat); obj.lng = Number(lng);
  saveCustomCams(customs);
  const c = techCameras.find(cc=>cc.name===name && cc.custom);
  if (c){
    c.lat = obj.lat; c.lng = obj.lng; c.region = regionFromLatLng(c.lat, c.lng);
    // update marker position
    try { c.marker?.setLatLng([c.lat, c.lng]); } catch {}
  }
  renderList();
}

window.toggleBookmark = function(name) {
  const c = techCameras.find(c => c.name === name);
  if (!c) return;
  if (bookmarked.has(c.name)) {
    bookmarked.delete(c.name);
  } else {
    bookmarked.add(c.name);
  }
  localStorage.setItem('bookmarkedCameras', JSON.stringify([...bookmarked]));
  c.marker?.setIcon(bookmarked.has(c.name) ? goldIcon : defaultIcon);
  renderList();
  // Also update wall views if present
  if (document.getElementById('wallGrid')) {
    const cols = Number(document.querySelector('#wallCols')?.value || 3);
    const critical = !!document.querySelector('#wallCriticalFirst')?.checked;
    try { renderWallGrid({ cols, critical }); } catch {}
  }
  if (document.getElementById('mwGrid')) {
    try { renderModalWallGrid(); } catch {}
  }
};

window.view = function(name) {
  localStorage.setItem("rname", name);
  localStorage.setItem("lstatus", "Live ●");
  window.location = "./camera-tech.html";
}

// Delay init until DOM is ready so elements exist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { init(); bindUI(); });
} else {
  init(); bindUI();
}

function init() {
  initializeMap();
  attachFilters();
  renderList();
}

function initializeMap() {
  const map = L.map("map").setView([20, 10], 2);
  window.techMap = map;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© OpenStreetMap contributors' }).addTo(map);

  const deleted = loadDeletedCams();
  techCameras.filter(c=>!deleted.has(c.name)).forEach(createMarker);

  // Load and add custom cameras from storage
  loadCustomCams().forEach(({name, lat, lng})=>{
    if (techCameras.find(c=>c.name===name)) return;
    if (deleted.has(name)) return;
    const c = makeTechCamera({ name, lat:Number(lat), lng:Number(lng) });
    c.custom = true;
    techCameras.push(c);
    createMarker(c);
  });
}

// Admin table renderer (for Manage Cameras modal)
function renderAdminTable(){
  const body = document.getElementById('adminCamBody');
  if (!body) return;
  body.innerHTML = '';
  // Merge all cameras for listing
  const customs = loadCustomCams();
  const deleted = loadDeletedCams();
  const q = (document.getElementById('adminCamSearch')?.value || '').toLowerCase();
  let all = [
    ...DataFetcher.cameras.map(c=>({ name:c.name, lat:c.lat, lng:c.lng, custom:false })),
    ...customs.map(c=>({ name:c.name, lat:Number(c.lat), lng:Number(c.lng), custom:true, createdAt: Number(c.createdAt||0) }))
  ];
  // Exclude deleted
  all = all.filter(x=> !deleted.has(x.name));
  // Apply search
  if (q) all = all.filter(x => x.name.toLowerCase().includes(q));
  // Sort according to adminSort or default (custom-first)
  if (adminSort.key) {
    const { key, dir } = adminSort;
    all.sort((a,b)=>{
      let va, vb;
      if (key === 'type') { va = a.custom?1:0; vb = b.custom?1:0; } else { va = a[key]; vb = b[key]; }
      if (typeof va === 'string') { const r = va.localeCompare(String(vb)); return dir==='asc'? r : -r; }
      const diff = (Number(va)||0) - (Number(vb)||0);
      return dir==='asc' ? diff : -diff;
    });
  } else {
    all.sort((a,b)=>{
      if (a.custom && !b.custom) return -1;
      if (!a.custom && b.custom) return 1;
      if (a.custom && b.custom) return (Number(b.createdAt||0) - Number(a.createdAt||0));
      return a.name.localeCompare(b.name);
    });
  }
  if (all.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="text-center text-muted">No cameras.</td>';
    body.appendChild(tr);
    return;
  }
  all.forEach(c => {
    const tr = document.createElement('tr');
    // Determine effective status via techCameras list and overrides
    const camObj = techCameras.find(t=>t.name===c.name);
    const effStatus = camObj ? getDisplayStatus(camObj) : 'online';
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.lat}</td>
      <td>${c.lng}</td>
      <td>${c.custom ? 'Custom' : 'Base'}</td>
      <td>
        <div class="d-flex align-items-center gap-1 flex-wrap">
          <select class="form-select form-select-sm" data-role="status">
            <option value="" ${effStatus=== (camObj?.status||'') ? 'selected' : ''}>Default</option>
            <option value="online" ${effStatus==='online' ? 'selected' : ''}>online</option>
            <option value="degraded" ${effStatus==='degraded' ? 'selected' : ''}>degraded</option>
            <option value="offline" ${effStatus==='offline' ? 'selected' : ''}>offline</option>
          </select>
          <button class="btn btn-sm btn-outline-primary" data-act="apply">Apply</button>
          <button class="btn btn-sm btn-outline-secondary" data-act="focus">Focus</button>
          <button class="btn btn-sm btn-outline-danger" data-act="del">Delete</button>
        </div>
      </td>`;
    // Apply status override
    tr.querySelector('[data-act="apply"]').addEventListener('click', ()=>{
      const sel = tr.querySelector('select[data-role="status"]');
      const v = sel.value;
      saveStatusOverride(c.name, v);
      // Optionally refresh walls/list quickly
      renderList();
    });
    tr.querySelector('[data-act="focus"]').addEventListener('click', ()=>{
      const cam = techCameras.find(x=>x.name===c.name);
      const modalEl = document.getElementById('adminCamsModal');
      // Hide modal first
      try { bootstrap.Modal.getOrCreateInstance(modalEl).hide(); } catch {}
      // After a short tick, focus map and open popup
      setTimeout(()=>{
        if (cam?.marker){
          window.techMap.setView([cam.lat, cam.lng], 8);
          cam.marker.openPopup();
        }
      }, 150);
    });
    const delBtn = tr.querySelector('[data-act="del"]');
    delBtn?.addEventListener('click', ()=>{
      const cam = techCameras.find(x=>x.name===c.name);
      const ds = cam ? getDisplayStatus(cam) : 'online';
      if (ds !== 'offline') { alert('Camera must be offline to delete'); return; }
      if (!confirm('Delete camera '+c.name+'?')) return;
      // If custom, remove from custom set
      if (c.custom) deleteCustomCam(c.name);
      // Soft delete across app
      const delSet = loadDeletedCams();
      delSet.add(c.name);
      saveDeletedCams(delSet);
      renderAdminTable();
      renderList();
    });
    body.appendChild(tr);
  });
  // Hook up sortable headers
  const thead = body.closest('table')?.querySelector('thead');
  thead?.querySelectorAll('th[data-key]')?.forEach(th=>{
    th.onclick = ()=>{
      const key = th.getAttribute('data-key');
      adminSort = adminSort.key === key ? { key, dir: (adminSort.dir==='asc'?'desc':'asc') } : { key, dir: 'asc' };
      renderAdminTable();
    };
  });
}

function createMarker(c){
  c.marker = L.marker([c.lat, c.lng], { icon: bookmarked.has(c.name) ? goldIcon : defaultIcon })
    .addTo(window.techMap)
    .bindPopup(() => {
      const isBookmarked = bookmarked.has(c.name);
      const ds = getDisplayStatus(c);
      const statusClass = ds === 'online' ? 'status-online' : (ds === 'degraded' ? 'status-degraded' : 'status-offline');
      return `
        <div style="min-width: 220px">
          <strong>${c.name}</strong><br>
          <small>${c.region}</small><br>
          <span class="status-badge ${statusClass}">${ds}</span><br>
          <div class="kv-grid" style="margin-top:.25rem;">
            <span class="kv kv-compact"><span class="kv-label">BR</span> <span class="${metricClass('bitrate', c.bitrateMbps)}">${c.bitrateMbps}</span> Mbps</span>
            <span class="kv kv-compact"><span class="kv-label">Temp</span> <span class="${metricClass('temp', c.temperatureC)}">${c.temperatureC}</span>°C</span>
            <span class="kv kv-compact"><span class="kv-label">Disk</span> <span class="${metricClass('storage', c.storageUsed)}">${c.storageUsed}</span>%</span>
          </div>
          <div class="action-row" style="margin-top:0.5rem;">
            <button class="vbutton ${isBookmarked ? 'bookmarked' : ''}" onclick="view('${c.name}')">👁️ View</button>
            <button class="vbutton ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${c.name}')">${isBookmarked ? 'Bookmarked' : 'Bookmark'}</button>
          </div>
        </div>`;
    });
}

// ===== Camera Wall (Fullscreen overlay) =====
let wallTickerInterval;

function wallSeverity(c) {
  const ds = getDisplayStatus(c);
  let s = ds === 'offline' ? 3 : (ds === 'degraded' ? 1 : 0);
  if (c.storageUsed >= 90) s += 2; else if (c.storageUsed >= 70) s += 1;
  if (c.temperatureC >= 40) s += 2; else if (c.temperatureC >= 35) s += 1;
  if (c.bitrateMbps < 2) s += 2; else if (c.bitrateMbps < 4) s += 1;
  return s;
}

function openWall() {
  // If modal exists, prefer modal popup instead of overlay (non-breaking)
  if (document.getElementById('cameraWallModal')) {
    openWallModal();
    return;
  }
  const overlay = document.querySelector('#cameraWall');
  const colsInput = document.querySelector('#wallCols');
  const critToggle = document.querySelector('#wallCriticalFirst');
  const alertsToggle = document.querySelector('#wallAlerts');
  const searchInput = document.querySelector('#wallSearch');
  const statusSel = document.querySelector('#wallStatus');
  const regionSel = document.querySelector('#wallRegion');
  const bookOnly = document.querySelector('#wallBookOnly');
  const grid = document.querySelector('#wallGrid');

  overlay.style.display = 'block';
  renderWallGrid({ cols: Number(colsInput.value), critical: !!critToggle.checked });
  setupTicker(!!alertsToggle?.checked);

  colsInput.addEventListener('input', () => renderWallGrid({ cols: Number(colsInput.value), critical: !!critToggle.checked }));
  critToggle.addEventListener('change', () => renderWallGrid({ cols: Number(colsInput.value), critical: !!critToggle.checked }));
  alertsToggle?.addEventListener('change', () => setupTicker(!!alertsToggle?.checked));
  searchInput?.addEventListener('input', () => renderWallGrid({ cols: Number(colsInput.value), critical: !!critToggle.checked }));
  statusSel?.addEventListener('change', () => renderWallGrid({ cols: Number(colsInput.value), critical: !!critToggle.checked }));
  regionSel?.addEventListener('change', () => renderWallGrid({ cols: Number(colsInput.value), critical: !!critToggle.checked }));
  bookOnly?.addEventListener('change', () => renderWallGrid({ cols: Number(colsInput.value), critical: !!critToggle.checked }));
}

function closeWall() {
  const overlay = document.querySelector('#cameraWall');
  overlay.style.display = 'none';
  if (wallTickerInterval) clearInterval(wallTickerInterval);
  wallTickerInterval = undefined;
}

function renderWallGrid({ cols = 3, critical = false } = {}) {
  const grid = document.querySelector('#wallGrid');
  if (!grid) return;
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0,1fr))`;

  let cams = [...techCameras];
  if (critical) cams.sort((a,b)=> wallSeverity(b) - wallSeverity(a));
  // Apply overlay filters if present
  const q = (document.querySelector('#wallSearch')?.value || '').toLowerCase();
  const st = document.querySelector('#wallStatus')?.value || '';
  const rg = document.querySelector('#wallRegion')?.value || '';
  const onlyBook = !!document.querySelector('#wallBookOnly')?.checked;
  const deleted = loadDeletedCams();
  cams = cams.filter(c => {
    if (deleted.has(c.name)) return false;
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (st && getDisplayStatus(c) !== st) return false;
    if (rg && c.region !== rg) return false;
    if (onlyBook && !bookmarked.has(c.name)) return false;
    return true;
  });

  grid.innerHTML = '';
  cams.forEach(c => {
    const tile = document.createElement('div');
    tile.className = `wall-tile ${regionClassName(c.region)} ${wallSeverity(c) >= 4 ? 'crit' : ''}`;
    const ds = getDisplayStatus(c);
    const statusClass = ds === 'online' ? 'status-online' : (ds === 'degraded' ? 'status-degraded' : 'status-offline');
    tile.innerHTML = `
      <div class="tile-head">
        <div class="fw-semibold">${c.name}</div>
      </div>
      <div class="video-wrap">
        <video src="v.mp4" muted autoplay loop playsinline></video>
        <span class="overlay-badge status-badge ${statusClass}">${ds}</span>
      </div>
      <div class="tile-meta">
        <span class="${metricClass('bitrate', c.bitrateMbps)}">${c.bitrateMbps} Mbps</span>
        <span class="${metricClass('temp', c.temperatureC)}">${c.temperatureC}°C</span>
        <span class="${metricClass('storage', c.storageUsed)}">${c.storageUsed}%</span>
      </div>
      <div class="action-row">
        <button class="vbutton" onclick="view('${c.name}')">👁️ View</button>
        <button class="vbutton ${bookmarked.has(c.name) ? 'bookmarked' : ''}" onclick="toggleBookmark('${c.name}')">${bookmarked.has(c.name) ? 'Bookmarked' : 'Bookmark'}</button>
      </div>
    `;
    grid.appendChild(tile);
  });
}

function setupTicker(enabled){
  const el = document.querySelector('#wallTicker');
  if (!el) return;
  if (wallTickerInterval) { clearInterval(wallTickerInterval); wallTickerInterval = undefined; }
  el.innerHTML = '';
  if (!enabled) return;
  const makeMsg = () => {
    const c = techCameras[Math.floor(Math.random()*techCameras.length)];
    const emojis = ['🐾','🦉','🦊','🐻','🦌','🦅','🐗','🦁','🐧','🦘'];
    const e = emojis[Math.floor(Math.random()*emojis.length)];
    return `<span>${e} ${new Date().toLocaleTimeString()} • ${c.name} · Temp ${c.temperatureC}°C · Storage ${c.storageUsed}%</span>`;
  };
  el.innerHTML = makeMsg() + makeMsg() + makeMsg();
  wallTickerInterval = setInterval(()=>{
    el.innerHTML = makeMsg() + makeMsg() + makeMsg();
  }, 8000);
}

function bindUI(){
  // Wall open/close
  const openBtn = document.querySelector('#openWallBtn');
  if (openBtn){
    if (document.getElementById('cameraWallModal')) {
      openBtn.addEventListener('click', openWallModal);
    } else {
      openBtn.addEventListener('click', openWall);
    }
  }
  document.querySelector('#closeWallBtn')?.addEventListener('click', closeWall);

  // Admin modal
  const adminBtn = document.querySelector('#openAdminBtn');
  const adminModalEl = document.getElementById('adminCamsModal');
  if (adminBtn && adminModalEl){
    // eslint-disable-next-line no-undef
    const adminModal = new bootstrap.Modal(adminModalEl);
    adminBtn.addEventListener('click', ()=>{ renderAdminTable(); adminModal.show(); });
    const form = document.getElementById('adminCamForm');
    form?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = document.getElementById('admName').value.trim();
      const lat = parseFloat(document.getElementById('admLat').value);
      const lng = parseFloat(document.getElementById('admLng').value);
      if (!name || Number.isNaN(lat) || Number.isNaN(lng)) return;
      const res = addCustomCam({ name, lat, lng });
      if (res.ok){
        form.reset();
        renderAdminTable();
      } else {
        alert(res.msg || 'Unable to add camera');
      }
    });
    // Admin search binding
    document.getElementById('adminCamSearch')?.addEventListener('input', renderAdminTable);
  }
}

// ===== Camera Wall (Modal variant using Bootstrap) =====
function openWallModal() {
  const modalEl = document.getElementById('cameraWallModal');
  if (!modalEl) return;
  // eslint-disable-next-line no-undef
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  renderModalWallGrid();

  const cols = document.getElementById('mwCols');
  const crit = document.getElementById('mwCriticalFirst');
  const search = document.getElementById('mwSearch');
  const status = document.getElementById('mwStatus');
  const region = document.getElementById('mwRegion');
  const book = document.getElementById('mwBookmarkedOnly');
  cols?.addEventListener('input', renderModalWallGrid);
  crit?.addEventListener('change', renderModalWallGrid);
  search?.addEventListener('input', renderModalWallGrid);
  status?.addEventListener('change', renderModalWallGrid);
  region?.addEventListener('change', renderModalWallGrid);
  book?.addEventListener('change', renderModalWallGrid);

  // Clean up any lingering overlay/backdrop when modal closes
  modalEl.addEventListener('hidden.bs.modal', () => {
    // Hide custom overlay if any
    const overlay = document.getElementById('cameraWall');
    if (overlay) overlay.style.display = 'none';
    // Remove any bootstrap backdrops left behind
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    // Reset body state if needed
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
  }, { once: true });
}

function renderModalWallGrid() {
  const grid = document.getElementById('mwGrid');
  if (!grid) return;
  const cols = Number(document.getElementById('mwCols')?.value || 3);
  const critical = !!document.getElementById('mwCriticalFirst')?.checked;
  const colMap = {2:'col-6',3:'col-4',4:'col-3',5:'col-xxl-2 col-lg-3 col-4',6:'col-2'};
  let cams = [...techCameras];
  if (critical) cams.sort((a,b)=> wallSeverity(b) - wallSeverity(a));
  // Filters
  const q = (document.getElementById('mwSearch')?.value || '').toLowerCase();
  const st = document.getElementById('mwStatus')?.value || '';
  const rg = document.getElementById('mwRegion')?.value || '';
  const onlyBook = !!document.getElementById('mwBookmarkedOnly')?.checked;
  const deleted = loadDeletedCams();
  cams = cams.filter(c => {
    if (deleted.has(c.name)) return false;
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (st && getDisplayStatus(c) !== st) return false;
    if (rg && c.region !== rg) return false;
    if (onlyBook && !bookmarked.has(c.name)) return false;
    return true;
  });
  grid.innerHTML = '';
  cams.forEach(c => {
    const ds = getDisplayStatus(c);
    const statusClass = ds === 'online' ? 'status-online' : (ds === 'degraded' ? 'status-degraded' : 'status-offline');
    const div = document.createElement('div');
    div.className = (colMap[cols] || 'col-4') + ' ' + regionClassName(c.region);
    div.innerHTML = `
      <div class="wall-tile h-100 d-flex flex-column">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="fw-semibold small">${c.name}</div>
        </div>
        <div class="video-wrap mb-1">
          <video src="v.mp4" class="w-100" muted autoplay loop playsinline></video>
          <span class="overlay-badge status-badge ${statusClass}">${ds}</span>
        </div>
        <div class="small mb-2 tile-meta" style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <span class="${metricClass('bitrate', c.bitrateMbps)}">${c.bitrateMbps} Mbps</span>
          <span class="${metricClass('temp', c.temperatureC)}">${c.temperatureC}°C</span>
          <span class="${metricClass('storage', c.storageUsed)}">${c.storageUsed}%</span>
        </div>
        <div class="action-row mt-auto">
          <button class="vbutton ${bookmarked.has(c.name) ? 'bookmarked' : ''}" onclick="view('${c.name}')">👁️ View</button>
          <button class="vbutton ${bookmarked.has(c.name) ? 'bookmarked' : ''}" onclick="toggleBookmark('${c.name}')">${bookmarked.has(c.name) ? 'Bookmarked' : 'Bookmark'}</button>
        </div>
      </div>`;
    grid.appendChild(div);
  });
}

// (openWallBtn is already bound above conditionally to modal or overlay)

function attachFilters() {
  const $search = document.querySelector("#searchTech");
  const $status = document.querySelector("#statusFilter");
  const $region = document.querySelector("#regionFilter");
  const $onlyBook = document.querySelector("#onlyBookmarked");
  const $criticalFirst = document.querySelector("#criticalFirst");

  [$search, $status, $region, $onlyBook, $criticalFirst].forEach(el => el && el.addEventListener("input", renderList));
  [$status, $region, $onlyBook, $criticalFirst].forEach(el => el && el.addEventListener("change", renderList));
}

function filteredCameras() {
  const q = (document.querySelector("#searchTech")?.value || '').toLowerCase();
  const status = document.querySelector("#statusFilter")?.value;
  const region = document.querySelector("#regionFilter")?.value;
  const onlyBook = document.querySelector("#onlyBookmarked")?.checked;
  const criticalFirst = document.querySelector("#criticalFirst")?.checked;

  const deleted = loadDeletedCams();
  const cams = techCameras.filter(c => {
    if (deleted.has(c.name)) return false;
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (status && c.status !== status) return false;
    if (region && c.region !== region) return false;
    if (onlyBook && !bookmarked.has(c.name)) return false;
    return true;
  });

  const severity = (c) => {
    // Status weight
    const ds = getDisplayStatus(c);
    let s = ds === 'offline' ? 3 : (ds === 'degraded' ? 1 : 0);
    // Metric weights
    if (c.storageUsed >= 90) s += 2; else if (c.storageUsed >= 70) s += 1;
    if (c.temperatureC >= 40) s += 2; else if (c.temperatureC >= 35) s += 1;
    if (c.bitrateMbps < 2) s += 2; else if (c.bitrateMbps < 4) s += 1;
    return s;
  };

  return cams.sort((a, b) => {
    if (criticalFirst) {
      const sd = severity(b) - severity(a);
      if (sd !== 0) return sd;
    }
    // Custom cameras first
    const aCust = !!a.custom, bCust = !!b.custom;
    if (aCust && !bCust) return -1;
    if (!aCust && bCust) return 1;
    if (aCust && bCust) {
      // When both custom, newest first using createdAt from localStorage
      const createdMap = Object.fromEntries((loadCustomCams()||[]).map(c=>[c.name, Number(c.createdAt||0)]));
      const ac = createdMap[a.name] || 0;
      const bc = createdMap[b.name] || 0;
      if (bc !== ac) return bc - ac;
    }
    // Keep bookmarked priority next
    const aBook = bookmarked.has(a.name);
    const bBook = bookmarked.has(b.name);
    if (aBook && !bBook) return -1;
    if (!aBook && bBook) return 1;
    return a.name.localeCompare(b.name);
  });
}

function renderList() {
  const list = document.getElementById("techCameraList");
  if (!list) return;
  list.innerHTML = '';
  const cams = filteredCameras();
  if (cams.length === 0) {
    const li = document.createElement("li");
    li.className = "list-group-item list-group-item-action";
    li.textContent = "No cameras match filters";
    list.appendChild(li);
    return;
  }
  cams.forEach(c => {
    const li = document.createElement("li");
    li.className = `list-group-item list-group-item-action ${bookmarked.has(c.name) ? 'gold' : ''}`;
    li.innerHTML = `
      <div class="d-flex w-100 justify-content-between align-items-start">
        <div class="tech-item-content flex-grow-1 pe-2">
          <div class="fw-semibold">${c.name}</div>
          <div class="small kv-grid mt-1">
            <span class="kv kv-compact"><span class="kv-label">BR</span> <span class="${metricClass('bitrate', c.bitrateMbps)}">${c.bitrateMbps}</span> Mbps</span>
            <span class="kv kv-compact"><span class="kv-label">Disk</span> <span class="${metricClass('storage', c.storageUsed)}">${c.storageUsed}</span>%</span>
            <span class="kv kv-compact"><span class="kv-label">Temp</span> <span class="${metricClass('temp', c.temperatureC)}">${c.temperatureC}</span>°C</span>
            <span class="kv kv-compact"><span class="kv-label"></span> ${c.region}</span>
          </div>
        </div>
        <div class="tech-actions d-flex flex-column align-items-end">
          <span class="status-badge ${getDisplayStatus(c) === 'online' ? 'status-online' : (getDisplayStatus(c) === 'degraded' ? 'status-degraded' : 'status-offline')}">${getDisplayStatus(c)}</span>
          <div class="action-row">
            <button class="vbutton ${bookmarked.has(c.name) ? 'bookmarked' : ''}" onclick="view('${c.name}')" title="View">👁️</button>
            <button class="vbutton ${bookmarked.has(c.name) ? 'bookmarked' : ''}" onclick="toggleBookmark('${c.name}')" title="${bookmarked.has(c.name) ? 'Remove bookmark' : 'Add bookmark'}">🔖</button>
          </div>
        </div>
      </div>`;
    list.appendChild(li);
  });
}
