// Technician Install Page
// Auth gate like other tech pages
if (localStorage.getItem('role') !== 'technician') {
  window.location = './authentication.html';
}

import { greyIcon } from './config.js';

function loadDevices(){
  try { return JSON.parse(localStorage.getItem('unassignedDevices')||'[]'); } catch { return []; }
}
function saveDevices(list){
  localStorage.setItem('unassignedDevices', JSON.stringify(list||[]));
}
function addDevice({ lat, lng }){
  const list = loadDevices();
  list.push({ id: Date.now()+"_"+Math.random().toString(36).slice(2), lat: Number(lat), lng: Number(lng) });
  saveDevices(list);
}
function removeDeviceById(id){
  const list = loadDevices().filter(d=>d.id!==id);
  saveDevices(list);
}

function regionFromLatLng(lat, lng) {
  if (lat > 0 && lng < -30 && lng > -170) return "North America";
  if (lat < 15 && lng < -30 && lng > -85) return "South America";
  if (lng >= -30 && lng <= 60 && lat > 30) return "Europe";
  if (lng >= -20 && lng <= 55 && lat < 30 && lat > -40) return "Africa";
  if (lng > 55 && lng <= 180 && lat >= -10) return "Asia";
  if (lat < 0 && ((lng >= 110 && lng <= 180) || (lng <= -150))) return "Oceania";
  return "Antarctica & Misc";
}

let map, pickMarker;
let deviceMarkers = [];

function enableAddButton(){
  const lat = Number(document.getElementById('lat').value);
  const lng = Number(document.getElementById('lng').value);
  const ok = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const btn = document.getElementById('addBtn');
  btn.disabled = !ok;
}

function renderList(){
  const listEl = document.getElementById('devList');
  const countEl = document.getElementById('count');
  const list = loadDevices();
  countEl.textContent = `${list.length} device${list.length===1?'':'s'}`;
  listEl.innerHTML = '';
  if (list.length === 0){
    listEl.innerHTML = '<div class="list-group-item text-muted">No unassigned devices</div>';
    refreshDeviceMarkers();
    return;
  }
  list.forEach((d, idx)=>{
    const item = document.createElement('div');
    const region = regionFromLatLng(d.lat, d.lng);
    item.className = 'list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2';
    item.innerHTML = `
      <span>#${idx+1} · ${Number(d.lat).toFixed(6)}, ${Number(d.lng).toFixed(6)} · <em>${region}</em></span>
      <span class="d-inline-flex gap-1">
        <button class="btn btn-secondary-tech btn-xs" data-act="focus">Focus</button>
        <button class="btn btn-tech btn-xs" data-act="assign">Assign</button>
        <button class="btn btn-danger-tech btn-xs" data-act="del">Delete</button>
      </span>`;
    item.querySelector('[data-act="focus"]').addEventListener('click', (e)=>{
      e.stopPropagation();
      try { map.setView([d.lat, d.lng], 8); } catch {}
    });
    item.querySelector('[data-act="assign"]').addEventListener('click', (e)=>{
      e.stopPropagation();
      try {
        localStorage.setItem('pendingAssignDevice', JSON.stringify({ lat: d.lat, lng: d.lng }));
      } catch {}
      window.location = './map-tech.html';
    });
    item.querySelector('[data-act="del"]').addEventListener('click', (e)=>{
      e.stopPropagation();
      if (!confirm('Delete this device?')) return;
      removeDeviceById(d.id);
      renderList();
    });
    listEl.appendChild(item);
  });
  refreshDeviceMarkers();
}

function initMap(){
  map = L.map('installMap').setView([20, 10], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
  map.on('click', (e)=>{
    const { lat, lng } = e.latlng;
    document.getElementById('lat').value = lat.toFixed(6);
    document.getElementById('lng').value = lng.toFixed(6);
    enableAddButton();
    if (!pickMarker){
      pickMarker = L.marker([lat, lng]).addTo(map);
    } else {
      pickMarker.setLatLng([lat, lng]);
    }
  });
}

function createDeviceMarker(dev){
  const m = L.marker([dev.lat, dev.lng], { icon: greyIcon })
    .addTo(map)
    .bindPopup(() => `
      <div style="min-width: 220px">
        <strong>Unassigned device</strong><br>
        <small>${regionFromLatLng(dev.lat, dev.lng)}</small>
        <div class="action-row" style="margin-top:0.5rem;">
          <button class="btn-tech" onclick="(function(lat,lng){try{localStorage.setItem('pendingAssignDevice', JSON.stringify({lat,lng}));}catch(e){} window.location='./map-tech.html';})(${dev.lat}, ${dev.lng})">Assign camera here</button>
        </div>
      </div>
    `);
  deviceMarkers.push(m);
}

function refreshDeviceMarkers(){
  try { deviceMarkers.forEach(m=>m.remove()); } catch {}
  deviceMarkers = [];
  (loadDevices()||[]).forEach(createDeviceMarker);
}

function initUI(){
  document.getElementById('lat').addEventListener('input', enableAddButton);
  document.getElementById('lng').addEventListener('input', enableAddButton);
  document.getElementById('addBtn').addEventListener('click', ()=>{
    const lat = Number(document.getElementById('lat').value);
    const lng = Number(document.getElementById('lng').value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    addDevice({ lat, lng });
    // Clear selection and marker
    try { pickMarker && pickMarker.remove(); pickMarker = undefined; } catch {}
    document.getElementById('lat').value = '';
    document.getElementById('lng').value = '';
    enableAddButton();
    renderList();
  });
}

function init(){
  initMap();
  initUI();
  renderList();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
