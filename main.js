import { db } from './src/db.js';
import { runRecurrenceEngine } from './src/engine.js';
import { renderDashboard } from './src/screens/dashboard.js';
import { renderExtrato } from './src/screens/extrato.js';
import { renderEntrada } from './src/screens/entrada.js';
import { renderPlanejamento } from './src/screens/planejamento.js';
import { auth, googleProvider, signInWithPopup, signOut } from './src/firebase.js';

const DOM = {
  mainContent: document.getElementById('main-content'),
  screenTitle: document.getElementById('screen-title'),
  navItems: document.querySelectorAll('.nav-item'),
  headerAvatars: document.getElementById('header-avatars'),
  appContainer: document.getElementById('app')
};

// E-mails autorizados
const AUTHORIZED_EMAILS = [
  // TODO: Adicione os emails reais do casal aqui
  "iuryadelaide@gmail.com",
  "sua-esposa@gmail.com"
];

function isAuthorized(email) {
  // Para testes durante desenvolvimento, pode retornar true
  // return true; 
  return AUTHORIZED_EMAILS.includes(email.toLowerCase());
}

async function renderLogin() {
  DOM.appContainer.innerHTML = `
    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; padding: 20px; text-align: center;">
      <h1 style="font-size: 2.5rem; margin-bottom: 10px; background: linear-gradient(to right, var(--primary-color), var(--success-color)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Mais Rico Juntos</h1>
      <p style="color: var(--text-secondary); margin-bottom: 40px;">Planejamento Financeiro para Casais</p>
      
      <button id="btn-login" class="btn btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 15px 30px; font-size: 1.1rem; border-radius: 30px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Entrar com Google
      </button>
      
      <div id="login-error" style="color: var(--danger-color); margin-top: 20px; display: none;"></div>
    </div>
  `;

  document.getElementById('btn-login').addEventListener('click', async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      if (!isAuthorized(user.email)) {
        await signOut(auth);
        const errDiv = document.getElementById('login-error');
        errDiv.textContent = 'Acesso Negado: E-mail não autorizado para este cofre.';
        errDiv.style.display = 'block';
      } else {
        window.location.reload(); // Reload to mount app properly
      }
    } catch (error) {
      console.error(error);
      const errDiv = document.getElementById('login-error');
      errDiv.textContent = 'Erro ao fazer login: ' + error.message;
      errDiv.style.display = 'block';
    }
  });
}

// Check auth state
auth.onAuthStateChanged(async (user) => {
  if (user && isAuthorized(user.email)) {
    // Inject original HTML structure back since we overwrote appContainer
    DOM.appContainer.innerHTML = `
      <header class="app-header">
        <h1 id="screen-title">Resumo</h1>
        <div class="user-avatars" id="header-avatars"></div>
      </header>
      <main id="main-content" class="screen-content"></main>
      <nav class="bottom-nav">
        <button class="nav-item active" data-target="dashboard">
          <span class="icon">📊</span>
          <span>Resumo</span>
        </button>
        <button class="nav-item fab-wrapper" data-target="entrada">
          <div class="fab"><span class="icon">+</span></div>
        </button>
        <button class="nav-item" data-target="planejamento">
          <span class="icon">🎯</span>
          <span>Metas</span>
        </button>
        <button class="nav-item" data-target="extrato">
          <span class="icon">📋</span>
          <span>Extrato</span>
        </button>
      </nav>
    `;
    
    // Re-bind DOM elements after injection
    DOM.mainContent = document.getElementById('main-content');
    DOM.screenTitle = document.getElementById('screen-title');
    DOM.navItems = document.querySelectorAll('.nav-item');
    DOM.headerAvatars = document.getElementById('header-avatars');
    
    await initApp();
  } else {
    renderLogin();
  }
});

async function initApp() {
  await db.init();
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
  
  // Add logout button to avatars area
  const logoutBtn = document.createElement('div');
  logoutBtn.innerHTML = '🚪';
  logoutBtn.style.cursor = 'pointer';
  logoutBtn.style.marginLeft = '10px';
  logoutBtn.title = 'Sair';
  logoutBtn.onclick = () => signOut(auth);
  DOM.headerAvatars.appendChild(logoutBtn);
}

export function navigate(screen) {
  DOM.navItems.forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(DOM.navItems).find(btn => btn.dataset.target === screen);
  if (activeBtn) activeBtn.classList.add('active');

  switch (screen) {
    case 'dashboard':
      DOM.screenTitle.textContent = 'Resumo';
      renderDashboard(DOM.mainContent);
      break;
    case 'extrato':
      DOM.screenTitle.textContent = 'Extrato';
      renderExtrato(DOM.mainContent);
      break;
    case 'entrada':
      DOM.screenTitle.textContent = 'Novo Lançamento';
      renderEntrada(DOM.mainContent);
      break;
    case 'planejamento':
      DOM.screenTitle.textContent = 'Planejamento e Metas';
      renderPlanejamento(DOM.mainContent);
      break;
  }
}
