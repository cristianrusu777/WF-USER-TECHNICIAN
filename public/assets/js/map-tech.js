import * as DataFetcher from "./modules/DataFetcher.js";
import { defaultIcon, goldIcon, greyIcon } from "./config.js";

// Auth gate for technician pages
if (localStorage.getItem('role') !== 'technician') {
  window.location = './authentication.html';
}

function refreshAllUIs(){
  try { renderList(); } catch {}
  // Refresh Manage Cameras if open
  if (document.getElementById('adminCamsModal')){
    try { renderAdminTable(); renderUnassignedList(); } catch {}
  }
  // Refresh Camera Wall overlay if present
  if (document.getElementById('wallGrid')){
    const cols = Number(document.querySelector('#wallCols')?.value || 3);
    const critical = !!document.querySelector('#wallCriticalFirst')?.checked;
    try { renderWallGrid({ cols, critical }); } catch {}
  }
  // Refresh Camera Wall modal if present
  if (document.getElementById('mwGrid')){
    try { renderModalWallGrid(); } catch {}
  }
}

function renameCamera(oldName, newName){
  newName = String(newName||'').trim();
  if (!newName) return { ok:false, msg:'Name cannot be empty' };
  if (oldName === newName) return { ok:true };
  // collision check across current runtime names
  if (techCameras.some(c=>c.name===newName)) return { ok:false, msg:'Name already exists' };
  // Custom path
  const isCustom = !!techCameras.find(c=>c.name===oldName && c.custom);
  if (isCustom){ return renameCustomCam(oldName, newName); }
  // Base camera: persist override
  const ov = loadNameOverrides();
  const cam = techCameras.find(c=>c.name===oldName && !c.custom);
  const key = cam?.originalName || oldName;
  ov[key] = newName;
  saveNameOverrides(ov);
  if (!cam) return { ok:false, msg:'Camera not found' };
  cam.name = newName;
  // move status overrides
  const so = loadStatusOverrides();
  if (Object.prototype.hasOwnProperty.call(so, oldName)){
    so[newName] = so[oldName];
    delete so[oldName];
    localStorage.setItem('statusOverrides', JSON.stringify(so));
  }
  // bookmarks
  if (bookmarked.has(oldName)) { bookmarked.delete(oldName); bookmarked.add(newName); localStorage.setItem('bookmarkedCameras', JSON.stringify([...bookmarked])); }
  // update marker popup later when opened; icon remains the same
  renderList();
  return { ok:true };
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

// ===== Unassigned physical devices (persisted in localStorage) =====
function loadDevices(){
  try { return JSON.parse(localStorage.getItem('unassignedDevices')||'[]'); } catch { return []; }
}
function saveDevices(list){
  localStorage.setItem('unassignedDevices', JSON.stringify(list));
}
function addDevice({lat, lng}){
  const list = loadDevices();
  list.push({ id: Date.now()+"_"+Math.random().toString(36).slice(2), lat:Number(lat), lng:Number(lng) });
  saveDevices(list);
}
function removeDeviceByCoords(lat, lng, eps=1e-6){
  const list = loadDevices();
  const idx = list.findIndex(d => Math.abs(d.lat-Number(lat))<eps && Math.abs(d.lng-Number(lng))<eps);
  if (idx>=0){ list.splice(idx,1); saveDevices(list); return true; }
  return false;
}
function hasDeviceAt(lat,lng, eps=1e-6){
  return loadDevices().some(d=> Math.abs(d.lat-Number(lat))<eps && Math.abs(d.lng-Number(lng))<eps);
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
  // Track the camera's original source name to support persistent overrides
  const originalName = c.originalName || c.name;
  return { ...c, originalName, region, status, bitrateMbps, temperatureC, storageUsed, uptimeHrs, lastHeartbeatMin, firmware, ip };
}

const techCameras = DataFetcher.cameras.map(makeTechCamera);

// ===== Name overrides (for base cameras) =====
function loadNameOverrides(){
  try { return JSON.parse(localStorage.getItem('nameOverrides')||'{}'); } catch { return {}; }
}
function saveNameOverrides(obj){
  localStorage.setItem('nameOverrides', JSON.stringify(obj||{}));
}

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

// Prefer custom cameras over base when deduping; for customs, pick newest createdAt
function dedupeTechCameras(){
  const createdMap = Object.fromEntries((loadCustomCams()||[]).map(c=>[c.name, Number(c.createdAt||0)]));
  const byName = new Map();
  for (const cam of techCameras){
    const existing = byName.get(cam.name);
    if (!existing){ byName.set(cam.name, cam); continue; }
    const aIsCustom = !!existing.custom; const bIsCustom = !!cam.custom;
    if (aIsCustom !== bIsCustom){
      byName.set(cam.name, bIsCustom ? cam : existing);
      continue;
    }
    // both same custom flag; if custom, pick newest by createdAt; else keep first
    if (aIsCustom){
      const aCreated = createdMap[existing.name] || 0;
      const bCreated = createdMap[cam.name] || 0;
      byName.set(cam.name, bCreated >= aCreated ? cam : existing);
    }
  }
  // Replace array in place to keep references where possible
  techCameras.length = 0;
  for (const cam of byName.values()) techCameras.push(cam);
}
function addCustomCam({name, lat, lng}){
  const customs = loadCustomCams();
  // Block duplicates across base and custom names
  if (DataFetcher.cameras.some(c=>c.name===name)) return { ok:false, msg:'Name already exists' };
  if (customs.find(c=>c.name===name)) return { ok:false, msg:'Name already exists' };
  if (techCameras.some(c=>c.name===name)) return { ok:false, msg:'Name already exists' };
  customs.push({name, lat, lng, createdAt: Date.now()});
  saveCustomCams(customs);
  // Add to runtime
  const c = makeTechCamera({ name, lat: Number(lat), lng: Number(lng) });
  c.custom = true;
  techCameras.push(c);
  // Place marker if map exists
  if (window.techMap) createMarker(c);
  // Deduplicate just in case
  dedupeTechCameras();
  refreshAllUIs();
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

function renameCustomCam(oldName, newName){
  newName = String(newName||'').trim();
  if (!newName) return { ok:false, msg:'Name cannot be empty' };
  if (oldName === newName) return { ok:true };
  // collision check against base and custom
  if (DataFetcher.cameras.some(c=>c.name===newName)) return { ok:false, msg:'Name already exists' };
  const customs = loadCustomCams();
  if (customs.some(c=>c.name===newName)) return { ok:false, msg:'Name already exists' };
  const obj = customs.find(c=>c.name===oldName);
  if (!obj) return { ok:false, msg:'Camera not found' };
  obj.name = newName;
  saveCustomCams(customs);
  // update runtime camera
  const cam = techCameras.find(c=>c.name===oldName && c.custom);
  if (cam){ cam.name = newName; }
  // move overrides
  const ov = loadStatusOverrides();
  if (Object.prototype.hasOwnProperty.call(ov, oldName)){
    ov[newName] = ov[oldName];
    delete ov[oldName];
    localStorage.setItem('statusOverrides', JSON.stringify(ov));
  }
  // bookmarks
  if (bookmarked.has(oldName)) { bookmarked.delete(oldName); bookmarked.add(newName); localStorage.setItem('bookmarkedCameras', JSON.stringify([...bookmarked])); }
  dedupeTechCameras();
  renderList();
  return { ok:true };
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

// Focus camera on the map and open its popup
window.focusCamera = function(name){
  const cam = techCameras.find(x=>x.name===name);
  if (!cam || !cam.marker || !window.techMap) return;
  try {
    window.techMap.setView([cam.lat, cam.lng], 8);
    cam.marker.openPopup();
  } catch {}
};

// Open Manage Cameras and focus the rename input for the specified camera
window.openRenameFor = function(name){
  const modalEl = document.getElementById('adminCamsModal');
  if (!modalEl) return;
  // Render table fresh, show modal, then focus the matching input
  try { renderAdminTable(); renderUnassignedList(); } catch {}
  try {
    const bs = bootstrap.Modal.getOrCreateInstance(modalEl);
    // Wait for modal animation to finish for reliable focus
    const handler = () => {
      // First try direct match
      let input = Array.from(document.querySelectorAll('#adminCamBody input[data-role="rename"]'))
        .find(el => el.value === name);
      if (!input){
        // Reset search and try again
        const search = document.querySelector('#adminCamSearch');
        if (search){ search.value = ''; renderAdminTable(); }
        input = Array.from(document.querySelectorAll('#adminCamBody input[data-role="rename"]'))
          .find(el => el.value === name);
      }
      if (!input){
        // Apply search to narrow and re-try
        const search = document.querySelector('#adminCamSearch');
        if (search){ search.value = name; renderAdminTable(); }
        input = Array.from(document.querySelectorAll('#adminCamBody input[data-role="rename"]'))
          .find(el => el.value === name);
      }
      if (input){
        input.classList.add('rename-target');
        input.focus(); input.select();
        try { input.scrollIntoView({ behavior:'smooth', block:'center' }); } catch {}
        input.addEventListener('blur', ()=> input.classList.remove('rename-target'), { once:true });
      }
      modalEl.removeEventListener('shown.bs.modal', handler);
    };
    modalEl.addEventListener('shown.bs.modal', handler);
    bs.show();
  } catch {}
};

// Delay init until DOM is ready so elements exist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { init(); bindUI(); });
} else {
  init(); bindUI();
}

function init() {
  initializeMap();
  attachFilters();
  // Apply base camera name overrides to runtime list using originalName
  const nov = loadNameOverrides();
  techCameras.forEach(cam=>{
    if (!cam.custom){
      const key = cam.originalName || cam.name;
      if (Object.prototype.hasOwnProperty.call(nov, key)){
        cam.name = nov[key];
      }
    }
  });
  // Dedupe any leftover duplicates by name (prefer custom entries)
  dedupeTechCameras();
  refreshAllUIs();
}

function initializeMap() {
  const map = L.map("map").setView([20, 10], 2);
  window.techMap = map;
  // Track device markers so we can refresh safely
  window.deviceMarkers = [];
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

  // Finally, render any unassigned device markers
  // Seed mock devices once if none exist
  if ((loadDevices()||[]).length === 0) {
    const seeds = [
      { lat: 51.500, lng: -0.120 },   // near London
      { lat: 40.4168, lng: -3.7038 }, // Madrid
      { lat: -33.865, lng: 151.209 }, // Sydney
      { lat: 37.7749, lng: -122.4194 } // San Francisco
    ];
    const unique = [];
    seeds.forEach(s=> unique.push({ lat: Number(s.lat), lng: Number(s.lng) }));
    saveDevices(unique);
  }
  refreshDeviceMarkers();
}

// Admin table renderer (for Manage Cameras modal)
function renderAdminTable(){
  const body = document.querySelector('#adminCamBody');
  if (!body) return;
  body.innerHTML = '';
  // Merge all cameras for listing
  const customs = loadCustomCams();
  const deleted = loadDeletedCams();
  const q = (document.querySelector('#adminCamSearch')?.value || '').toLowerCase();
  const stFilter = (document.querySelector('#adminStatusFilter')?.value || '').toLowerCase();
  let all = [
    ...techCameras.map(c=>({ name:c.name, lat:c.lat, lng:c.lng, custom:!!c.custom }))
  ];
  // Exclude deleted
  all = all.filter(x=> !deleted.has(x.name));
  // Apply search
  if (q) all = all.filter(x => x.name.toLowerCase().includes(q));
  // Apply status filter
  if (stFilter){
    all = all.filter(x=>{
      const camObj = techCameras.find(t=>t.name===x.name);
      const eff = camObj ? getDisplayStatus(camObj) : 'online';
      return eff === stFilter;
    });
  }
  // Sort according to adminSort or default (custom-first)
  if (adminSort.key) {
    const { key, dir } = adminSort;
    all.sort((a,b)=>{
      let va, vb;
      if (key==='region') { va = regionFromLatLng(a.lat,a.lng); vb = regionFromLatLng(b.lat,b.lng); }
      else { va = a[key]; vb = b[key]; }
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
    const region = camObj ? camObj.region : regionFromLatLng(c.lat, c.lng);
    tr.innerHTML = `
      <td><input class="form-control form-control-sm" data-role="rename" value="${c.name}" /></td>
      <td>${c.lat}</td>
      <td>${c.lng}</td>
      <td>${region}</td>
      <td>
        <div class="d-flex align-items-center gap-1 flex-wrap">
          <select class="form-select form-select-sm status-select-tech" data-role="status">
            <option value="online" ${effStatus==='online' ? 'selected' : ''}>online</option>
            <option value="degraded" ${effStatus==='degraded' ? 'selected' : ''}>degraded</option>
            <option value="offline" ${effStatus==='offline' ? 'selected' : ''}>offline</option>
          </select>
          <button class="btn btn-sm btn-secondary-tech" data-act="focus">Focus</button>
          <button class="btn btn-sm btn-danger-tech" data-act="del">Delete</button>
        </div>
      </td>`;
    // apply status color to select
    const statusSel = tr.querySelector('select[data-role="status"]');
    const applyStatusClass = ()=>{
      statusSel.classList.remove('status-online-select','status-degraded-select','status-offline-select');
      const v = statusSel.value || (camObj?.status||'');
      if (v==='online') statusSel.classList.add('status-online-select');
      else if (v==='degraded') statusSel.classList.add('status-degraded-select');
      else if (v==='offline') statusSel.classList.add('status-offline-select');
    };
    applyStatusClass();
    statusSel.addEventListener('change', ()=>{
      applyStatusClass();
      const v = statusSel.value;
      saveStatusOverride(c.name, v);
      renderList();
    });
    // Rename handler (all cams)
    const rn = tr.querySelector('input[data-role="rename"]');
    const oldName = c.name;
    rn.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ rn.blur(); } });
    rn.addEventListener('blur', ()=>{
      const newName = rn.value.trim();
      if (newName === oldName) return;
      const res = renameCamera(oldName, newName);
      if (!res.ok){ alert(res.msg||'Rename failed'); rn.value = oldName; return; }
      renderAdminTable();
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
      // Re-evaluate status: prefer the row's selected value if provided, else effective status
      const selVal = tr.querySelector('select[data-role="status"]')?.value || '';
      const ds = selVal || (cam ? getDisplayStatus(cam) : 'online');
      if (ds !== 'offline') { alert('Camera must be offline to delete'); return; }
      if (!confirm('Delete camera '+c.name+'?')) return;
      // If custom, remove from custom set
      if (c.custom) deleteCustomCam(c.name);
      // Soft delete across app
      const delSet = loadDeletedCams();
      delSet.add(c.name);
      saveDeletedCams(delSet);
      // Convert to unassigned device at same location
      if (cam){
        addDevice({ lat: cam.lat, lng: cam.lng });
        try { cam.marker?.remove(); } catch {}
        refreshDeviceMarkers();
        // Update unassigned list if modal is open
        try { renderUnassignedList(); } catch {}
      }
      renderAdminTable();
      renderList();
    });
    body.appendChild(tr);
  });

  // Do not append unassigned devices here; they are listed in the Unassigned devices section above.

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
          <div class="kv-grid" style="margin-top:.25rem;">
            <span class="kv kv-compact"><span class="kv-label">BR</span> <span class="${metricClass('bitrate', c.bitrateMbps)}">${c.bitrateMbps}</span> Mbps</span>
            <span class="kv kv-compact"><span class="kv-label">Temp</span> <span class="${metricClass('temp', c.temperatureC)}">${c.temperatureC}</span>°C</span>
            <span class="kv kv-compact"><span class="kv-label">Disk</span> <span class="${metricClass('storage', c.storageUsed)}">${c.storageUsed}</span>%</span>
            <span class="status-badge ${statusClass}">${ds}</span>
          </div>
          <div class="action-row" style="margin-top:0.5rem;">
            <button class="btn-tech" onclick="view('${c.name}')">👁️ View</button>
            <button class="btn-tech" onclick="toggleBookmark('${c.name}')">${isBookmarked ? 'Bookmarked' : 'Bookmark'}</button>
            <button class="btn-tech" onclick="openRenameFor('${c.name}')">Rename</button>
          </div>
        </div>`;
    });
}

// Create grey markers for unassigned devices
function createDeviceMarker(dev){
  const m = L.marker([dev.lat, dev.lng], { icon: greyIcon })
    .addTo(window.techMap)
    .bindPopup(() => `
      <div style="min-width: 220px">
        <strong>Unassigned device</strong><br>
        <small>${regionFromLatLng(dev.lat, dev.lng)}</small>
        <div class="action-row" style="margin-top:0.5rem;">
          <button class="btn-tech" onclick="assignFromDevice(${dev.lat}, ${dev.lng})">Assign camera here</button>
        </div>
      </div>
    `);
  try { window.deviceMarkers.push(m); } catch {}
}

function refreshDeviceMarkers(){
  try { (window.deviceMarkers||[]).forEach(m=>m.remove()); } catch {}
  window.deviceMarkers = [];
  (loadDevices()||[]).forEach(createDeviceMarker);
  // Keep the modal list in sync if it's open
  try { renderUnassignedList(); } catch {}
}

function setPendingDevice(lat, lng){
  window.__pendingDevice = { lat, lng };
  const latEl = document.querySelector('#admLat');
  const lngEl = document.querySelector('#admLng');
  if (latEl) latEl.value = Number(lat).toFixed(6);
  if (lngEl) lngEl.value = Number(lng).toFixed(6);
  updateAddBtnState();
  // Contextual guidance in Manage Cameras modal
  try {
    const info = document.querySelector('#adminCamsModal .alert-info');
    if (info){
      info.innerHTML = `Device selected at <strong>${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}</strong>. Enter a camera name, then click <strong>Add</strong> to assign it here.`;
    }
    const nameEl = document.querySelector('#admName');
    if (nameEl){
      nameEl.classList.add('rename-target');
      // If modal is open, focus; otherwise next show will focus
      try { nameEl.focus(); nameEl.select?.(); } catch {}
      nameEl.addEventListener('blur', ()=> nameEl.classList.remove('rename-target'), { once:true });
    }
  } catch {}
}

function renderUnassignedList(){
  const wrap = document.querySelector('#unassignedList');
  if (!wrap) return;
  const devs = loadDevices()||[];
  if (devs.length === 0){ wrap.innerHTML = '<div class="list-group-item text-muted">No unassigned devices</div>'; return; }
  wrap.innerHTML = '';
  devs.forEach((d, idx)=>{
    const el = document.createElement('div');
    el.className = 'list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2';
    const region = regionFromLatLng(d.lat, d.lng);
    el.innerHTML = `
      <span>#${idx+1} · ${Number(d.lat).toFixed(6)}, ${Number(d.lng).toFixed(6)} · <em>${region}</em></span>
      <span class="d-inline-flex gap-1">
        <button class="btn btn-secondary-tech btn-xs" data-act="focus">Focus</button>
        <button class="btn btn-tech btn-xs" data-act="select">Select</button>
      </span>`;
    el.querySelector('[data-act="select"]').addEventListener('click', (e)=>{ e.stopPropagation(); setPendingDevice(d.lat, d.lng); });
    el.querySelector('[data-act="focus"]').addEventListener('click', (e)=>{ e.stopPropagation(); try { window.techMap.setView([d.lat, d.lng], 8); } catch {} });
    wrap.appendChild(el);
  });
}

function updateAddBtnState(){
  const btn = document.querySelector('#admAddBtn');
  if (!btn) return;
  const hasDev = !!window.__pendingDevice;
  // Enable Add as soon as a device is selected; name is still validated on submit
  btn.disabled = !hasDev;
  btn.textContent = hasDev ? 'Add' : 'Add (select device)';
  btn.title = hasDev ? '' : 'Select an unassigned device from the list or map';
}

// Open Manage Cameras modal with coords prefilled
window.assignFromDevice = function(lat, lng){
  // Always prefill coords (readonly), set pending, and open the modal; user clicks Add to complete
  setPendingDevice(lat, lng);
  const modalEl = document.querySelector('#adminCamsModal');
  if (modalEl){
    try {
      renderAdminTable();
      renderUnassignedList();
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    } catch {}
  }
  setTimeout(()=> document.querySelector('#admName')?.focus(), 100);
};

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
        <div class="fw-semibold wall-name" style="cursor:pointer;">${c.name}</div>
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
    // Click only on the name to go back to map and focus this camera
    tile.querySelector('.wall-name')?.addEventListener('click', (e) => {
      e.stopPropagation();
      try { closeWall(); } catch {}
      setTimeout(()=> focusCamera(c.name), 100);
    });
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
  const adminModalEl = document.querySelector('#adminCamsModal');
  if (adminBtn && adminModalEl){
    // eslint-disable-next-line no-undef
    const adminModal = new bootstrap.Modal(adminModalEl);
    adminBtn.addEventListener('click', ()=>{ renderAdminTable(); adminModal.show(); });
    const form = document.querySelector('#adminCamForm');
    form?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = document.querySelector('#admName')?.value.trim();
      if (!name){
        alert('Enter a camera name first.');
        document.querySelector('#admName')?.focus();
        return;
      }
      if (!window.__pendingDevice){
        alert('Click a grey device (map or list) to select placement.');
        return;
      }
      const { lat, lng } = window.__pendingDevice;
      const res = addCustomCam({ name, lat, lng });
      if (res.ok){
        window.__pendingDevice = null;
        form.reset();
        // clear readonly fields
        const latEl = document.querySelector('#admLat');
        const lngEl = document.querySelector('#admLng');
        if (latEl) latEl.value = '';
        if (lngEl) lngEl.value = '';
        removeDeviceByCoords(lat, lng);
        refreshDeviceMarkers();
        renderAdminTable();
      } else {
        alert(res.msg || 'Unable to assign camera');
      }
    });
    // Admin search & status filter binding
    document.querySelector('#adminCamSearch')?.addEventListener('input', renderAdminTable);
    document.querySelector('#adminStatusFilter')?.addEventListener('change', renderAdminTable);

    // Handle redirect from install page with a pending device
    try {
      const pending = localStorage.getItem('pendingAssignDevice');
      if (pending) {
        localStorage.removeItem('pendingAssignDevice');
        const payload = JSON.parse(pending);
        const lat = Number(payload?.lat), lng = Number(payload?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setPendingDevice(lat, lng);
          renderAdminTable();
          renderUnassignedList();
          adminModal.show();
          setTimeout(()=> {
            // Focus and highlight the name input for quick action
            const nameEl = document.querySelector('#admName');
            if (nameEl){
              nameEl.classList.add('rename-target');
              nameEl.focus();
              nameEl.select?.();
              nameEl.addEventListener('blur', ()=> nameEl.classList.remove('rename-target'), { once:true });
            }
            // Update helper information with specific guidance
            const info = document.querySelector('#adminCamsModal .alert-info');
            if (info){
              info.innerHTML = `Device selected at <strong>${lat.toFixed(6)}, ${lng.toFixed(6)}</strong>. Enter a camera name, then click <strong>Add</strong> to assign it here.`;
            }
          }, 100);
        }
      }
    } catch {}
  }
}

// ===== Camera Wall (Modal variant using Bootstrap) =====
function openWallModal() {
  const modalEl = document.querySelector('#cameraWallModal');
  if (!modalEl) return;
  // eslint-disable-next-line no-undef
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  renderModalWallGrid();

  const cols = document.querySelector('#mwCols');
  const crit = document.querySelector('#mwCriticalFirst');
  const search = document.querySelector('#mwSearch');
  const status = document.querySelector('#mwStatus');
  const region = document.querySelector('#mwRegion');
  const book = document.querySelector('#mwBookmarkedOnly');
  cols?.addEventListener('input', renderModalWallGrid);
  crit?.addEventListener('change', renderModalWallGrid);
  search?.addEventListener('input', renderModalWallGrid);
  status?.addEventListener('change', renderModalWallGrid);
  region?.addEventListener('change', renderModalWallGrid);
  book?.addEventListener('change', renderModalWallGrid);

  // Clean up any lingering overlay/backdrop when modal closes
  modalEl.addEventListener('hidden.bs.modal', () => {
    // Hide custom overlay if any
    const overlay = document.querySelector('#cameraWall');
    if (overlay) overlay.style.display = 'none';
    // Remove any bootstrap backdrops left behind
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    // Reset body state if needed
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
  }, { once: true });
}

function renderModalWallGrid() {
  const grid = document.querySelector('#mwGrid');
  if (!grid) return;
  const cols = Number(document.querySelector('#mwCols')?.value || 3);
  const critical = !!document.querySelector('#mwCriticalFirst')?.checked;
  const colMap = {2:'col-6',3:'col-4',4:'col-3',5:'col-xxl-2 col-lg-3 col-4',6:'col-2'};
  let cams = [...techCameras];
  if (critical) cams.sort((a,b)=> wallSeverity(b) - wallSeverity(a));
  // Filters
  const q = (document.querySelector('#mwSearch')?.value || '').toLowerCase();
  const st = document.querySelector('#mwStatus')?.value || '';
  const rg = document.querySelector('#mwRegion')?.value || '';
  const onlyBook = !!document.querySelector('#mwBookmarkedOnly')?.checked;
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
          <div class="fw-semibold small wall-name" style="cursor:pointer;">${c.name}</div>
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
    // Clicking only the name redirects to map and focuses this camera
    const nameEl = div.querySelector('.wall-name');
    nameEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      const modalEl = document.querySelector('#cameraWallModal');
      if (modalEl){
        try { bootstrap.Modal.getOrCreateInstance(modalEl).hide(); } catch {}
      }
      setTimeout(()=> focusCamera(c.name), 150);
    });
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
    if (status && getDisplayStatus(c) !== status) return false;
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

  const createdMap = Object.fromEntries((loadCustomCams()||[]).map(c=>[c.name, Number(c.createdAt||0)]));
  return cams.sort((a, b) => {
    if (criticalFirst) {
      const sd = severity(b) - severity(a);
      if (sd !== 0) return sd;
    }
    // 1) Bookmarked cameras at top
    const aBook = bookmarked.has(a.name);
    const bBook = bookmarked.has(b.name);
    if (aBook !== bBook) return aBook ? -1 : 1;
    // 2) New/custom cameras above others (newest first)
    const aCust = !!a.custom, bCust = !!b.custom;
    if (aCust !== bCust) return aCust ? -1 : 1;
    if (aCust && bCust) {
      const ac = createdMap[a.name] || 0;
      const bc = createdMap[b.name] || 0;
      if (bc !== ac) return bc - ac;
    }
    // 3) Name
    return a.name.localeCompare(b.name);
  });
}

function renderList() {
  const list = document.querySelector("#techCameraList");
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
          <div class="fw-semibold" style="cursor:pointer" onclick="focusCamera('${c.name}')">${c.name}</div>
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
