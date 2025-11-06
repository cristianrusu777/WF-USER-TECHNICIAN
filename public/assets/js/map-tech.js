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

function attachFilters() {
  const $search = document.querySelector("#searchTech");
  const $status = document.querySelector("#statusFilter");
  const $region = document.querySelector("#regionFilter");
  const $onlyBook = document.querySelector("#onlyBookmarked");

  [$search, $status, $region, $onlyBook].forEach(el => el && el.addEventListener("input", renderList));
  [$status, $region, $onlyBook].forEach(el => el && el.addEventListener("change", renderList));
}

function filteredCameras() {
  const q = (document.querySelector("#searchTech")?.value || '').toLowerCase();
  const status = document.querySelector("#statusFilter")?.value;
  const region = document.querySelector("#regionFilter")?.value;
  const onlyBook = document.querySelector("#onlyBookmarked")?.checked;

  return techCameras.filter(c => {
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (status && c.status !== status) return false;
    if (region && c.region !== region) return false;
    if (onlyBook && !bookmarked.has(c.name)) return false;
    return true;
  }).sort((a, b) => {
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
