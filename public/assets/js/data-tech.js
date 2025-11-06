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

function generateData(selectedRegions, selectedStatus, from, to) {
  const start = from ? new Date(from) : new Date(Date.now() - 7*24*60*60*1000);
  const end = to ? new Date(to) : new Date();
  const rows = [];
  const cams = DataFetcher.cameras.filter(c => selectedRegions.length===0 || selectedRegions.includes(regionFromLatLng(c.lat,c.lng)));
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
      <td><button class="toStyleTheButtonOnTheDataPage" onclick="(function(name){localStorage.setItem('rname', name); localStorage.setItem('lstatus','Replay ●'); window.location='./camera-tech.html';})('${r.camera}')">View</button></td>`;
    body.appendChild(tr);
  });
}

let chart;
function renderChart(data){
  const ctx = document.querySelector("#t_chart").getContext("2d");
  const labels = data.map(d=>d.dateTime.split(" ")[1]);
  const bitrate = data.map(d=>d.bitrate);
  const temp = data.map(d=>d.temp);
  if (chart) chart.destroy();
  // Use Chart.js if available (included in HTML)
  // eslint-disable-next-line no-undef
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Bitrate (Mbps)', data: bitrate, borderColor: 'hsl(200, 70%, 45%)', tension: 0.3 },
        { label: 'Temp (°C)', data: temp, borderColor: 'hsl(12, 70%, 45%)', tension: 0.3 }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' }}}
  });
}

function getSelected(id){
  return Array.from(document.querySelector(`#${id}`).selectedOptions).map(o=>o.value);
}

function init(){
  document.querySelector("#t_generateBtn").addEventListener("click", ()=>{
    const regions = getSelected("t_regionSelect");
    const status = getSelected("t_statusSelect");
    const from = document.querySelector("#t_fromDate").value;
    const to = document.querySelector("#t_toDate").value;
    const data = generateData(regions, status, from, to);
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
    renderTable(data);
    renderChart(data);
  });
}

init();
