// Simple client-side auth (passwordless) for prototype purposes
// Registers/logs in by email, auto-assigns an Adria ID per user.

(function(){
  const USERS_KEY = 'users.passwordless.email.v2';
  const SESSION_KEY = 'session.email';

  function loadUsers(){
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch { return {}; }
  }
  function saveUsers(db){ localStorage.setItem(USERS_KEY, JSON.stringify(db)); }

  function normEmail(e){ return (e||'').trim().toLowerCase(); }
  function isValidEmail(e){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e||''); }
  function genAdriaId(){
    const n = Math.floor(1000 + Math.random()*9000);
    return `A-${n}`;
  }

  const Auth = {
    async register(email){
      const key = normEmail(email);
      if (!isValidEmail(key)) throw new Error('Invalid email');
      const db = loadUsers();
      if (db[key]) throw new Error('User already exists');
      db[key] = { email: key, adriaId: genAdriaId(), tier: 'Basic', createdAt: Date.now() };
      saveUsers(db);
      localStorage.setItem(SESSION_KEY, key);
      return { email: key };
    },
    async login(email){
      const key = normEmail(email);
      const db = loadUsers();
      if (!db[key]) throw new Error('Unknown email');
      localStorage.setItem(SESSION_KEY, key);
      return { email: key };
    },
    logout(){ localStorage.removeItem(SESSION_KEY); },
    getCurrentUser(){ return localStorage.getItem(SESSION_KEY); },
    getUserTier(email){ const u = loadUsers()[normEmail(email)]; return u?.tier || 'Basic'; },
    setUserTier(email, tier){ const db = loadUsers(); const key = normEmail(email); if (db[key]) { db[key].tier = tier; saveUsers(db);} },
    getUserAdriaId(email){ const u = loadUsers()[normEmail(email)]; return u?.adriaId || ''; },
    changeEmail(oldEmail, newEmail){
      const from = normEmail(oldEmail);
      const to = normEmail(newEmail);
      if (!isValidEmail(to)) throw new Error('Invalid email');
      const db = loadUsers();
      if (!db[from]) throw new Error('Current user not found');
      if (db[to]) throw new Error('Email already in use');
      db[to] = { ...db[from], email: to };
      delete db[from];
      saveUsers(db);
      // migrate notes store keys
      try {
        const raw = localStorage.getItem('cameraNotes.v1');
        if (raw){
          const notes = JSON.parse(raw)||{};
          const prefix = from + '::';
          const updated = {};
          Object.keys(notes).forEach(k=>{
            if (k.startsWith(prefix)){
              updated[to + '::' + k.substring(prefix.length)] = notes[k];
            } else {
              updated[k] = notes[k];
            }
          });
          localStorage.setItem('cameraNotes.v1', JSON.stringify(updated));
        }
      } catch{}
      // update session
      localStorage.setItem(SESSION_KEY, to);
      return { email: to };
    }
  };

  window.Auth = Auth;
})();
