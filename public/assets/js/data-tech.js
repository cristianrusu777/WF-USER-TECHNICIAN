import * as DataFetcher from "./modules/DataFetcher.js";

function regionFromLatLng(lat, lng) {
  if (lat > 0 && lng < -30 && lng > -170) return "North America";
  if (lat < 15 && lng < -30 && lng > -85) return "South America";
  if (lng >= -30 && lng <= 60 && lat > 30) return "Europe";
  if (lng >= -20 && lng <= 55 && lat < 30 && lat > -40) return "Africa";
  if (lng > 55 && lng <= 180 && lat >= -10) return "Asia";
  if (lat < 0 && ((lng >= 110 && lng <= 180) || (lng <= -150))) return "Oceania";
  return "Antarctica & Misc";
}

function randomChoice(arr){return arr[Math.floor(Math.random()*arr.length)]}
function randInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function randFloat(min,max,dec=1){return +(Math.random()*(max-min)+min).toFixed(dec)}

// Helpers to style status and metrics
function statusBadge(status){
  const cls = status === 'online' ? 'status-online' : (status === 'degraded' ? 'status-degraded' : 'status-offline');
  return `<span class="status-badge ${cls}">${status}</span>`;
}
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
    case 'uptime':
      if (value < 6) return 'metric metric-crit';
      if (value < 24) return 'metric metric-warn';
      return 'metric metric-ok';
    default:
      return '';
  }
}

function makeRow(cam){
  const status = randomChoice(["online","online","online","degraded","offline"]);
  const bitrate = randFloat(2,10);
  const temp = randFloat(10,40);
  const storage = randInt(10,95);
  const uptime = randInt(1,720);
  const ip = `10.${randInt(0,255)}.${randInt(0,255)}.${randInt(1,254)}`;
  const region = regionFromLatLng(cam.lat, cam.lng);
  const date = new Date(Date.now() - randInt(0,7*24)*60*60*1000);
  const dateTime = date.toISOString().slice(0,16).replace("T"," ");
  return {dateTime, camera: cam.name, region, status, bitrate, temp, storage, uptime, ip};
}

function getCustomCams(){
  try { return JSON.parse(localStorage.getItem('adminCustomCameras')||'[]'); } catch { return []; }
}

function generateData(selectedRegions, selectedStatus, from, to, cameraNames = []) {
  const start = from ? new Date(from) : new Date(Date.now() - 7*24*60*60*1000);
  const end = to ? new Date(to) : new Date();
  const rows = [];
  // Merge built-in and custom cameras
  const base = DataFetcher.cameras;
  const customs = getCustomCams().map(c=>({ name: c.name, lat: Number(c.lat), lng: Number(c.lng) }));
  const all = base.concat(customs);
  const cams = all.filter(c => {
    if (selectedRegions.length>0 && !selectedRegions.includes(regionFromLatLng(c.lat,c.lng))) return false;
    if (cameraNames.length>0 && !cameraNames.includes(c.name)) return false;
    return true;
  });
  const entries = Math.min(300, cams.length * 15);
  for (let i=0;i<entries;i++) {
    const cam = randomChoice(cams);
    const row = makeRow(cam);
    const t = new Date(start.getTime() + Math.random()*(end.getTime()-start.getTime()));
    row.dateTime = t.toISOString().slice(0,16).replace("T"," ");
    if (selectedStatus.length===0 || selectedStatus.includes(row.status)) rows.push(row);
  }
  return rows.sort((a,b)=> new Date(a.dateTime)-new Date(b.dateTime));
}

function renderTable(data){
  const body = document.querySelector("#t_dataBody");
  body.innerHTML = "";
  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.dateTime}</td>
      <td>${r.camera}</td>
      <td>${r.region}</td>
      <td>${statusBadge(r.status)}</td>
      <td><span class="${metricClass('bitrate', r.bitrate)}">${r.bitrate}</span></td>
      <td><span class="${metricClass('temp', r.temp)}">${r.temp}</span></td>
      <td><span class="${metricClass('storage', r.storage)}">${r.storage}</span></td>
      <td><span class="${metricClass('uptime', r.uptime)}">${r.uptime}</span></td>
      <td><code style="font-family: monospace; background:#f6f8fa; padding:0.1rem 0.25rem; border-radius:4px;">${r.ip}</code></td>
      <td><button class="btn-tech btn-sm" onclick="(function(name){localStorage.setItem('rname', name); localStorage.setItem('lstatus','Replay ●'); window.location='./camera-tech.html';})('${r.camera}')">View</button></td>`;
    body.appendChild(tr);
  });
}

let chart;
let currentData = [];
let sortState = { key: null, dir: 'asc' };

function getAllCameras() {
  const base = (DataFetcher.cameras || []).map(c => ({ name: c.name, lat: c.lat, lng: c.lng }));
  let customs = [];
  try { customs = (JSON.parse(localStorage.getItem('adminCustomCameras')||'[]')||[]).map(c=>({ name:c.name, lat:Number(c.lat), lng:Number(c.lng) })); } catch {}
  // de-dupe by name (prefer custom)
  const map = new Map();
  base.forEach(c => { if (!map.has(c.name)) map.set(c.name, c); });
  customs.forEach(c => { map.set(c.name, c); });
  return Array.from(map.values()).sort((a,b)=> a.name.localeCompare(b.name));
}

function populateCameraSelect() {
  const sel = document.querySelector('#t_cameraSelect');
  if (!sel) return;
  const prev = sel.value || '';
  // clear and add "All cameras"
  sel.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'All cameras';
  sel.appendChild(allOpt);
  // add cameras
  getAllCameras().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
  // restore previous value if still present
  if (Array.from(sel.options).some(o=>o.value===prev)) sel.value = prev; else sel.value = '';
}

function renderChartForCamera(data, cameraName){
  const title = document.querySelector('#t_chartTitle');
  if (!cameraName) {
    // No selection or no data: clear chart and show instruction
    if (chart) { try { chart.destroy(); } catch {} chart = undefined; }
    if (title) title.innerText = 'Select a camera to view graphs';
    return;
  }
  const filtered = data.filter(d => d.camera === cameraName);
  const ctx = document.querySelector("#t_chart")?.getContext("2d");
  if (!ctx || filtered.length === 0){
    if (chart) { try { chart.destroy(); } catch {} chart = undefined; }
    if (title) title.innerText = `No data available for ${cameraName}`;
    return;
  }
  const labels = filtered.map(d=>d.dateTime);
  const bitrate = filtered.map(d=>d.bitrate);
  const temp = filtered.map(d=>d.temp);
  if (chart) chart.destroy();
  // eslint-disable-next-line no-undef
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Bitrate (Mbps)',
          data: bitrate,
          borderColor: 'hsl(200, 70%, 45%)',
          backgroundColor: 'hsla(200, 70%, 45%, 0.15)',
          yAxisID: 'y',
          tension: 0.25,
          pointRadius: 2,
          fill: true
        },
        {
          label: 'Temp (°C)',
          data: temp,
          borderColor: 'hsl(12, 70%, 45%)',
          backgroundColor: 'hsla(12, 70%, 45%, 0.15)',
          yAxisID: 'y1',
          tension: 0.25,
          pointRadius: 2,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { title: (items)=> items?.[0]?.label || '' } }
      },
      scales: {
        x: {
          ticks: { maxTicksLimit: 8, color: '#475569' },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        y: {
          title: { display: true, text: 'Bitrate (Mbps)' },
          ticks: { color: '#475569' },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        y1: {
          title: { display: true, text: 'Temp (°C)' },
          position: 'right',
          ticks: { color: '#475569' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
  if (title) title.innerText = `Bitrate & Temperature Over Time · ${cameraName}`;
}

function getSelected(id){
  // For single-select dropdowns, return the value (string).
  // For multi-select (status), return array of selected values.
  const el = document.querySelector(`#${id}`);
  if (!el) return '';
  if (el.multiple) return Array.from(el.selectedOptions).map(o=>o.value);
  return el.value || '';
}

function compareValues(a, b, key){
  // Decide comparison type
  if (key === 'dateTime') {
    return new Date(a.dateTime) - new Date(b.dateTime);
  }
  if (key === 'status') {
    const order = { online: 0, degraded: 1, offline: 2 };
    const av = order[String(a.status)||''] ?? 99;
    const bv = order[String(b.status)||''] ?? 99;
    return av - bv;
  }
  if (['bitrate','temp','storage','uptime'].includes(key)) {
    return (Number(a[key]) || 0) - (Number(b[key]) || 0);
  }
  // string compare default
  return String(a[key] || '').localeCompare(String(b[key] || ''));
}

function applySort() {
  if (!sortState.key) return currentData;
  const { key, dir } = sortState;
  currentData.sort((a,b)=>{
    const cmp = compareValues(a,b,key);
    return dir === 'asc' ? cmp : -cmp;
  });
}

function setupSorting(){
  const headers = document.querySelectorAll('#t_dataTable thead th[data-key]');
  headers.forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-key');
      if (sortState.key === key) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.key = key;
        sortState.dir = 'asc';
      }
      applySort();
      renderTable(currentData);
      const cam = document.querySelector('#t_cameraSelect')?.value || '';
      renderChartForCamera(currentData, cam);
    });
  });
}

function init(){
  populateCameraSelect();
  // Default remains "All cameras"; do not override with last viewed camera
  document.querySelector("#t_generateBtn").addEventListener("click", ()=>{
    const regionVal = getSelected("t_regionSelect");
    const regions = regionVal ? [regionVal] : []; // empty means all
    let status = getSelected("t_statusSelect");
    if (Array.isArray(status) && status.includes('all')) status = [];
    const cameraVal = document.querySelector('#t_cameraSelect')?.value || '';
    const from = document.querySelector("#t_fromDate").value;
    const to = document.querySelector("#t_toDate").value;
    const data = generateData(regions, status, from, to, cameraVal ? [cameraVal] : []);
    const criticalFirst = document.querySelector('#t_criticalFirst')?.checked;
    if (criticalFirst) {
      const sev = (r) => {
        let s = r.status === 'offline' ? 3 : (r.status === 'degraded' ? 1 : 0);
        if (r.storage >= 90) s += 2; else if (r.storage >= 70) s += 1;
        if (r.temp >= 40) s += 2; else if (r.temp >= 35) s += 1;
        if (r.bitrate < 2) s += 2; else if (r.bitrate < 4) s += 1;
        if (r.uptime < 6) s += 2; else if (r.uptime < 24) s += 1;
        return s;
      };
      data.sort((a,b)=> sev(b)-sev(a));
    }
    currentData = data;
    // Reset sort on new data (default by date asc already)
    sortState = { key: null, dir: 'asc' };
    renderTable(currentData);
    let cam = cameraVal || '';
    if (!cam) {
      const uniq = Array.from(new Set(currentData.map(r=>r.camera)));
      if (uniq.length === 1) { cam = uniq[0]; }
    }
    renderChartForCamera(currentData, cam);
  });
  // Re-render chart when camera selection changes
  document.querySelector('#t_cameraSelect')?.addEventListener('change', (e)=>{
    const cam = e.target.value || '';
    renderChartForCamera(currentData, cam);
  });
  setupSorting();
  // Auto-generate on load with default selections (All regions/status/cameras, 7-day range by default)
  try { document.querySelector('#t_generateBtn')?.click(); } catch {}
}

init();
