// Wireframe-only technician credentials handling

function isValidEmail(e){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e||''); }

function init(){
  const form = document.querySelector('#techLoginForm');
  const email = document.querySelector('#techEmail');
  const error = document.querySelector('#techError');

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    if (!isValidEmail(email.value)) {
      error.style.display = 'block';
      return;
    }
    error.style.display = 'none';
    localStorage.setItem('role','technician');
    localStorage.setItem('techEmail', email.value.trim().toLowerCase());
    window.location = './map-tech.html';
  });
}

document.addEventListener('DOMContentLoaded', init);

init();
