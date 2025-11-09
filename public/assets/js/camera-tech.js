// Technician camera details page wiring (wireframe-only)
import * as DataFetcher from "./modules/DataFetcher.js";

// Auth gate for technician pages
if (localStorage.getItem('role') !== 'technician') {
  window.location = './authentication.html';
}

function rand(arr){return arr[Math.floor(Math.random()*arr.length)]}
function randInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function randFloat(min,max,dec=1){return +(Math.random()*(max-min)+min).toFixed(dec)}

function metricClass(name, value){
  switch(name){
    case 'bitrate':
      if (value < 2) return ['metric','metric-crit'];
      if (value < 4) return ['metric','metric-warn'];
      return ['metric','metric-ok'];
    case 'temp':
      if (value >= 40) return ['metric','metric-crit'];
      if (value >= 35) return ['metric','metric-warn'];
      return ['metric','metric-ok'];
    case 'storage':
      if (value >= 90) return ['metric','metric-crit'];
      if (value >= 70) return ['metric','metric-warn'];
      return ['metric','metric-ok'];
    case 'uptime':
      if (value < 6) return ['metric','metric-crit'];
      if (value < 24) return ['metric','metric-warn'];
      return ['metric','metric-ok'];
    default:
      return [];
  }
}

// Simple helpers for description persistence
function loadDescriptions(){
  try { return JSON.parse(localStorage.getItem('cameraDescriptions')||'{}'); } catch { return {}; }
}
function saveDescriptions(obj){
  localStorage.setItem('cameraDescriptions', JSON.stringify(obj||{}));
}

function seedDescriptionsIfEmpty(){
  const cur = loadDescriptions();
  if (cur && Object.keys(cur).length > 0) return;
  const seed = {
    "Grizzly Cam - Yellowstone": "Monitors grizzly activity near river crossings in Yellowstone.",
    "Eagle Eye - Yosemite": "High vantage point for raptors and cliff wildlife in Yosemite.",
    "Lion Lookout - Serengeti": "Oversees lion pride territory and migration routes.",
    "Kangaroo Cam - Outback": "Tracks kangaroo movement in arid outback conditions.",
    "Penguin Patrol - McMurdo": "Observes penguin colonies near McMurdo Station."
  };
  try { saveDescriptions(seed); } catch {}
}

function debounce(fn, wait=300){
  let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

function loadNameOverrides(){
  try { return JSON.parse(localStorage.getItem('nameOverrides')||'{}'); } catch { return {}; }
}

function tryResolveCoordsByName(rname){
  // 1) custom cameras from adminCustomCameras
  try {
    const customs = JSON.parse(localStorage.getItem('adminCustomCameras')||'[]')||[];
    const hit = customs.find(c=>c.name===rname);
    if (hit) return { lat: Number(hit.lat), lng: Number(hit.lng) };
  } catch {}
  // 2) renamed base camera: reverse-lookup nameOverrides (original -> new)
  const ov = loadNameOverrides();
  const original = Object.keys(ov).find(k => ov[k] === rname);
  if (original){
    const base = (DataFetcher.cameras||[]).find(c=>c.name===original);
    if (base) return { lat: Number(base.lat), lng: Number(base.lng) };
  }
  // 3) direct match in base list
  const direct = (DataFetcher.cameras||[]).find(c=>c.name===rname);
  if (direct) return { lat: Number(direct.lat), lng: Number(direct.lng) };
  return null;
}

function mockDetails() {
  return {
    status: rand(["online","online","degraded","offline"]),
    bitrate: randFloat(2,10),
    temp: randFloat(10,40),
    storage: randInt(10,95),
    uptime: randInt(1,720),
    heartbeat: randInt(0,20),
    firmware: rand(["v1.9.2","v2.0.0","v2.1.3","v2.2.0-rc1"]),
    ip: `10.${randInt(0,255)}.${randInt(0,255)}.${randInt(1,254)}`
  }
}

function loadCustomCams(){
  try { return JSON.parse(localStorage.getItem('adminCustomCameras')||'[]'); } catch { return []; }
}
function saveCustomCams(list){
  localStorage.setItem('adminCustomCameras', JSON.stringify(list));
}
function isCustomCamera(name){
  return !!loadCustomCams().find(c=>c.name===name);
}
function deleteCustomCam(name){
  const list = loadCustomCams().filter(c=>c.name!==name);
  saveCustomCams(list);
}

function loadDeletedCams(){
  try { return new Set(JSON.parse(localStorage.getItem('deletedCameras')||'[]')); } catch { return new Set(); }
}
function saveDeletedCams(set){
  localStorage.setItem('deletedCameras', JSON.stringify([...set]));
}

function loadStatusOverrides(){
  try { return JSON.parse(localStorage.getItem('statusOverrides')||'{}'); } catch { return {}; }
}
function saveStatusOverride(name, status){
  const o = loadStatusOverrides();
  if (!status) delete o[name]; else o[name] = status;
  localStorage.setItem('statusOverrides', JSON.stringify(o));
}
function getDisplayStatus(name, fallback){
  const o = loadStatusOverrides();
  return o[name] || fallback;
}

function init() {
  const rname = localStorage.getItem("rname") || "Unknown Camera";
  const lstatus = localStorage.getItem("lstatus") || "Live ●";
  document.querySelector("#rname").textContent = rname;
  document.querySelector("#lstatus").textContent = lstatus;

  const d = mockDetails();
  // Populate description from persistence; default none
  seedDescriptionsIfEmpty();
  const descEl = document.querySelector('#t_desc');
  const descMap = loadDescriptions();
  // If there is a seeded description in DataFetcher, use it only when no local value exists
  let currentDesc = (descMap[rname] || '').trim();
  if (!currentDesc) {
    // Try base or override name
    const base = (DataFetcher.cameras||[]).find(c=>c.name===rname);
    currentDesc = (base?.description || '').trim();
  }
  if (descEl) descEl.value = currentDesc;
  const doSave = ()=>{
    const map = loadDescriptions();
    const val = String(descEl?.value||'').trim();
    if (!val) { delete map[rname]; } else { map[rname] = val; }
    saveDescriptions(map);
  };
  // Save on blur and while typing (debounced)
  descEl?.addEventListener('blur', doSave);
  descEl?.addEventListener('input', debounce(doSave, 250));
  // If there is an override, display it instead of mock
  d.status = getDisplayStatus(rname, d.status);
  const $status = document.querySelector("#t_status");
  $status.textContent = d.status;
  $status.classList.remove("status-online","status-degraded","status-offline");
  if (d.status === "online") $status.classList.add("status-online");
  else if (d.status === "degraded") $status.classList.add("status-degraded");
  else $status.classList.add("status-offline");
  // Top-right live/offline indicator
  const liveEl = document.querySelector('#lstatus');
  if (liveEl){
    if (d.status === 'offline') { liveEl.textContent = 'Offline'; liveEl.classList.add('live-offline'); }
    else { liveEl.textContent = 'Live ●'; liveEl.classList.remove('live-offline'); }
  }
  const $bitrate = document.querySelector("#t_bitrate");
  const $temp = document.querySelector("#t_temp");
  const $storage = document.querySelector("#t_storage");
  const $uptime = document.querySelector("#t_uptime");
  $bitrate.textContent = d.bitrate;
  $temp.textContent = d.temp;
  $storage.textContent = d.storage;
  $uptime.textContent = d.uptime;
  [$bitrate,$temp,$storage,$uptime].forEach(el=>el.classList.remove('metric','metric-ok','metric-warn','metric-crit'));
  metricClass('bitrate', d.bitrate).forEach(c=> $bitrate.classList.add(c));
  metricClass('temp', d.temp).forEach(c=> $temp.classList.add(c));
  metricClass('storage', d.storage).forEach(c=> $storage.classList.add(c));
  metricClass('uptime', d.uptime).forEach(c=> $uptime.classList.add(c));
  document.querySelector("#t_heartbeat").textContent = d.heartbeat;
  document.querySelector("#t_firmware").textContent = d.firmware;
  document.querySelector("#t_ip").textContent = d.ip;

  // Wire mocked actions
  document.querySelector("#btnUpdate")?.addEventListener("click", ()=>{
    alert("Firmware update scheduled");
  });
  document.querySelector("#btnDiagnose")?.addEventListener("click", ()=>{
    alert("Diagnostics started");
  });

  // Inline status picker
  document.querySelectorAll('#statusInline [data-status]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      const v = btn.getAttribute('data-status');
      saveStatusOverride(rname, v);
      // Reflect immediately in UI
      $status.textContent = v;
      $status.classList.remove("status-online","status-degraded","status-offline");
      if (v === "online") $status.classList.add("status-online");
      else if (v === "degraded") $status.classList.add("status-degraded");
      else $status.classList.add("status-offline");
      // Update top-right live/offline label
      const liveEl = document.querySelector('#lstatus');
      if (liveEl){
        if (v === 'offline') { liveEl.textContent = 'Offline'; liveEl.classList.add('live-offline'); }
        else { liveEl.textContent = 'Live ●'; liveEl.classList.remove('live-offline'); }
      }
      // Update Delete button availability
      const $del = document.querySelector('#btnDeleteCam');
      if (v === 'offline') { $del.disabled = false; $del.title = ''; }
      else { $del.disabled = true; $del.title = 'Camera must be offline to delete'; }
    });
  });

  // Delete camera (only when offline). Base cams are soft-deleted via localStorage so they disappear across the app.
  const $del = document.querySelector('#btnDeleteCam');
  const isOffline = (d.status === 'offline');
  if (isOffline) {
    $del.disabled = false;
    $del.title = '';
  } else {
    $del.disabled = true;
    $del.title = 'Camera must be offline to delete';
  }
  $del.addEventListener('click', () =>{
    if (d.status !== 'offline') return;
    if (!confirm('Delete camera '+rname+'?')) return;
    // If custom, remove from the custom list
    if (isCustomCamera(rname)) deleteCustomCam(rname);
    // Mark as deleted globally so it disappears in map/list/wall
    const deleted = loadDeletedCams();
    deleted.add(rname);
    saveDeletedCams(deleted);
    // Navigate back to map (list will update on load)
    window.location = './map-tech.html';
  });
}

init();
