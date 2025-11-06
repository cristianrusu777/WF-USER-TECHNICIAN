import * as DataFetcher from "./modules/DataFetcher.js";
import { defaultIcon, goldIcon } from "./config.js";

// Auth gate for technician pages
if (localStorage.getItem('role') !== 'technician') {
  window.location = './authentication.html';
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
};

window.view = function(name) {
  localStorage.setItem("rname", name);
  localStorage.setItem("lstatus", "Live ●");
  window.location = "./camera-tech.html";
}

init();

function init() {
  initializeMap();
  attachFilters();
  renderList();
}

function initializeMap() {
  const map = L.map("map").setView([20, 10], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '© OpenStreetMap contributors' }).addTo(map);

  techCameras.forEach(c => {
    c.marker = L.marker([c.lat, c.lng], { icon: bookmarked.has(c.name) ? goldIcon : defaultIcon }).addTo(map).bindPopup(() => {
      const isBookmarked = bookmarked.has(c.name);
      const statusClass = c.status === 'online' ? 'status-online' : (c.status === 'degraded' ? 'status-degraded' : 'status-offline');
      return `
        <div style="min-width: 220px">
          <strong>${c.name}</strong><br>
          <small>${c.region}</small><br>
          <span class="status-badge ${statusClass}">${c.status}</span><br>
          Bitrate: <span class="${metricClass('bitrate', c.bitrateMbps)}">${c.bitrateMbps}</span> Mbps · Temp: <span class="${metricClass('temp', c.temperatureC)}">${c.temperatureC}</span>°C<br>
          Storage: <span class="${metricClass('storage', c.storageUsed)}">${c.storageUsed}</span>%<br>
          <div class="action-row" style="margin-top:0.5rem;">
            <button class="vbutton ${isBookmarked ? 'bookmarked' : ''}" onclick="view('${c.name}')">👁️ View</button>
            <button class="vbutton ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${c.name}')">${isBookmarked ? 'Bookmarked' : 'Bookmark'}</button>
          </div>
        </div>`;
    });
  });
}

// ===== Camera Wall (Fullscreen overlay) =====
let wallTickerInterval;

function wallSeverity(c) {
  let s = c.status === 'offline' ? 3 : (c.status === 'degraded' ? 1 : 0);
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
  const grid = document.querySelector('#wallGrid');

  overlay.style.display = 'block';
  renderWallGrid({ cols: Number(colsInput.value), critical: !!critToggle.checked });
  setupTicker(!!alertsToggle.checked);

  colsInput.addEventListener('input', () => renderWallGrid({ cols: Number(colsInput.value), critical: !!critToggle.checked }));
  critToggle.addEventListener('change', () => renderWallGrid({ cols: Number(colsInput.value), critical: !!critToggle.checked }));
  alertsToggle.addEventListener('change', () => setupTicker(!!alertsToggle.checked));
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

  grid.innerHTML = '';
  cams.slice(0, cols * 4).forEach(c => {
    const tile = document.createElement('div');
    tile.className = `wall-tile ${wallSeverity(c) >= 4 ? 'crit' : ''}`;
    const statusClass = c.status === 'online' ? 'status-online' : (c.status === 'degraded' ? 'status-degraded' : 'status-offline');
    tile.innerHTML = `
      <div class="tile-head">
        <div class="fw-semibold">${c.name}</div>
        <span class="status-badge ${statusClass}">${c.status}</span>
      </div>
      <video src="v.mp4" muted autoplay loop playsinline></video>
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

// Hook up open/close
document.querySelector('#openWallBtn')?.addEventListener('click', openWall);
document.querySelector('#closeWallBtn')?.addEventListener('click', closeWall);

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
  cols?.addEventListener('input', renderModalWallGrid);
  crit?.addEventListener('change', renderModalWallGrid);
}

function renderModalWallGrid() {
  const grid = document.getElementById('mwGrid');
  if (!grid) return;
  const cols = Number(document.getElementById('mwCols')?.value || 3);
  const critical = !!document.getElementById('mwCriticalFirst')?.checked;
  const colMap = {2:'col-6',3:'col-4',4:'col-3',5:'col-xxl-2 col-lg-3 col-4',6:'col-2'};
  let cams = [...techCameras];
  if (critical) cams.sort((a,b)=> wallSeverity(b) - wallSeverity(a));
  grid.innerHTML = '';
  cams.slice(0, cols * 4).forEach(c => {
    const statusClass = c.status === 'online' ? 'status-online' : (c.status === 'degraded' ? 'status-degraded' : 'status-offline');
    const div = document.createElement('div');
    div.className = colMap[cols] || 'col-4';
    div.innerHTML = `
      <div class="border rounded p-2 h-100 d-flex flex-column">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="fw-semibold small">${c.name}</div>
          <span class="status-badge ${statusClass}">${c.status}</span>
        </div>
        <video src="v.mp4" class="w-100 mb-1" muted autoplay loop playsinline></video>
        <div class="small mb-2" style="display:flex;gap:0.5rem;flex-wrap:wrap;">
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

// Open modal via the same button without removing overlay behavior
document.querySelector('#openWallBtn')?.addEventListener('click', openWallModal);

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

  const cams = techCameras.filter(c => {
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (status && c.status !== status) return false;
    if (region && c.region !== region) return false;
    if (onlyBook && !bookmarked.has(c.name)) return false;
    return true;
  });

  const severity = (c) => {
    // Status weight
    let s = c.status === 'offline' ? 3 : (c.status === 'degraded' ? 1 : 0);
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
    // Keep bookmarked priority next
    const aBook = bookmarked.has(a.name);
    const bBook = bookmarked.has(b.name);
    if (aBook && !bBook) return -1;
    if (!aBook && bBook) return 1;
    return a.name.localeCompare(b.name);
  });
}

function renderList() {
  const list = document.querySelector("#techCameraList");
  list.innerHTML = "";
  const cams = filteredCameras();
  if (cams.length === 0) {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.textContent = "No cameras match filters";
    list.appendChild(li);
    return;
  }
  cams.forEach(c => {
    const li = document.createElement("li");
    li.className = `list-group-item list-group-item-action ${bookmarked.has(c.name) ? 'gold' : ''}`;
    li.innerHTML = `
      <div class="d-flex w-100 justify-content-between align-items-center">
        <div>
          <div class="fw-semibold">${c.name} <span class="status-badge ${c.status === 'online' ? 'status-online' : (c.status === 'degraded' ? 'status-degraded' : 'status-offline')}">${c.status}</span></div>
          <small>${c.region} · <span class="${metricClass('bitrate', c.bitrateMbps)}">${c.bitrateMbps}</span> Mbps · <span class="${metricClass('temp', c.temperatureC)}">${c.temperatureC}</span>°C · <span class="${metricClass('storage', c.storageUsed)}">${c.storageUsed}</span>% disk</small>
        </div>
        <div class="action-row">
          <button class="vbutton ${bookmarked.has(c.name) ? 'bookmarked' : ''}" onclick="view('${c.name}')">👁️</button>
          <button class="vbutton ${bookmarked.has(c.name) ? 'bookmarked' : ''}" onclick="toggleBookmark('${c.name}')">${bookmarked.has(c.name) ? 'Bookmarked' : 'Bookmark'}</button>
        </div>
      </div>`;
    list.appendChild(li);
  });
}
