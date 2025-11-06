// Technician camera details page wiring (wireframe-only)

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

function init() {
  const rname = localStorage.getItem("rname") || "Unknown Camera";
  const lstatus = localStorage.getItem("lstatus") || "Live ●";
  document.querySelector("#rname").textContent = rname;
  document.querySelector("#lstatus").textContent = lstatus;

  const d = mockDetails();
  const $status = document.querySelector("#t_status");
  $status.textContent = d.status;
  $status.classList.remove("status-online","status-degraded","status-offline");
  if (d.status === "online") $status.classList.add("status-online");
  else if (d.status === "degraded") $status.classList.add("status-degraded");
  else $status.classList.add("status-offline");
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
  document.querySelector("#btnRestart").addEventListener("click", ()=>{
    alert("Restart command queued (mock)");
  });
  document.querySelector("#btnUpdate").addEventListener("click", ()=>{
    alert("Firmware update scheduled (mock)");
  });
  document.querySelector("#btnDiagnose").addEventListener("click", ()=>{
    alert("Diagnostics started (mock)");
  });
}

init();
