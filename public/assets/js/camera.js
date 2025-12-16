document.querySelector("#rname").textContent = localStorage.getItem("rname") || "Unknown Camera";
document.querySelector("#lstatus").textContent = localStorage.getItem("lstatus") || "Live ●";

// Timestamped notes per user and camera
(function(){
  const video = document.querySelector('#mainVideo');
  const form = document.querySelector('#noteForm');
  const input = document.querySelector('#noteText');
  const list = document.querySelector('#notesList');
  const cameraName = localStorage.getItem('rname') || 'Unknown Camera';

  function loadStore(){
    try { return JSON.parse(localStorage.getItem('cameraNotes.v1')||'{}'); } catch { return {}; }
  }
  function saveStore(db){ localStorage.setItem('cameraNotes.v1', JSON.stringify(db||{})); }
  function getUser(){ return (window.Auth && Auth.getCurrentUser && Auth.getCurrentUser()) || null; }
  function key(email, cam){ return `${email}::${cam}`; }

  function secondsToHMS(s){
    s = Math.max(0, Math.floor(s||0));
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return [h,m,sec].map((v,i)=> (i===0? v : String(v).padStart(2,'0'))).join(':');
  }

  function render(){
    list.innerHTML = '';
    const email = getUser();
    const db = loadStore();
    const arr = email ? (db[key(email, cameraName)]||[]) : [];
    arr.sort((a,b)=> a.t - b.t);
    arr.forEach((n, idx)=>{
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm';
      btn.textContent = secondsToHMS(n.t);
      btn.addEventListener('click', ()=>{ if (video){ video.currentTime = n.t; video.play(); }});
      const span = document.createElement('span');
      span.textContent = n.text;
      const del = document.createElement('button');
      del.className = 'btn btn-sm';
      del.textContent = 'Delete';
      del.addEventListener('click', ()=>{
        const store = loadStore();
        const k = key(email, cameraName);
        const listArr = store[k]||[];
        listArr.splice(idx,1);
        store[k] = listArr;
        saveStore(store);
        render();
      });
      const left = document.createElement('div');
      left.className = 'd-flex align-items-center gap-2';
      left.appendChild(btn);
      left.appendChild(span);
      li.appendChild(left);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  if (form){
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const email = getUser();
      if (!email){
        window.location = './user-login.html?redirect=camera.html';
        return;
      }
      const text = (input.value||'').trim();
      if (!text) return;
      const t = Math.floor(video ? video.currentTime || 0 : 0);
      const db = loadStore();
      const k = key(email, cameraName);
      const arr = db[k] || [];
      arr.push({ t, text, createdAt: Date.now() });
      db[k] = arr;
      saveStore(db);
      input.value = '';
      render();
    });
  }

  render();
})();
