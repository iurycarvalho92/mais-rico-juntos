import { db } from './src/db.js';
import { runRecurrenceEngine } from './src/engine.js';
import { renderDashboard } from './src/screens/dashboard.js';
import { renderExtrato } from './src/screens/extrato.js';
import { renderEntrada } from './src/screens/entrada.js';

const DOM = {
  mainContent: document.getElementById('main-content'),
  screenTitle: document.getElementById('screen-title'),
  navItems: document.querySelectorAll('.nav-item'),
  headerAvatars: document.getElementById('header-avatars')
};

async function initApp() {
  db.init();
  await runRecurrenceEngine();
  await renderAvatars();
  
  // Set up navigation
  DOM.navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      navigate(target);
    });
  });

  // Load default screen
  navigate('dashboard');
}

async function renderAvatars() {
  const users = await db.getTable('utilizadores');
  DOM.headerAvatars.innerHTML = users.map(u => 
    `<div class="avatar" style="background-color: ${u.cor_avatar}">${u.nome.charAt(0)}</div>`
  ).join('');
}

export function navigate(screen) {
  // Update nav UI
  DOM.navItems.forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(DOM.navItems).find(btn => btn.dataset.target === screen);
  if (activeBtn) activeBtn.classList.add('active');

  // Route
  switch (screen) {
    case 'dashboard':
      DOM.screenTitle.textContent = 'Dashboard';
      renderDashboard(DOM.mainContent);
      break;
    case 'extrato':
      DOM.screenTitle.textContent = 'Extrato Mensal';
      renderExtrato(DOM.mainContent);
      break;
    case 'entrada':
      DOM.screenTitle.textContent = 'Nova Transação';
      renderEntrada(DOM.mainContent);
      break;
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', initApp);
