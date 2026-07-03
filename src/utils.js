/**
 * Shared utilities for Mais Rico Juntos
 */

/** Formatador de moeda BRL compartilhado (instância única) */
export const f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Retorna a string "YYYY-MM" do mês atual sem depender de UTC
 */
export function getCurrentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Formata uma Date local para string "YYYY-MM-DD" sem deslocamento de fuso horário
 */
export function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Cria e exibe um modal de confirmação in-app em vez de usar confirm() nativo
 * @param {string} message - Mensagem de confirmação
 * @returns {Promise<boolean>} - true se confirmado, false se cancelado
 */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8); display: flex; justify-content: center;
      align-items: center; z-index: 9999; padding: 20px;
    `;
    overlay.innerHTML = `
      <div style="background: var(--bg-color); border: 1px solid var(--glass-border);
        border-radius: var(--radius-md); padding: 24px; width: 100%; max-width: 360px; text-align: center;">
        <p style="font-size: 1rem; margin-bottom: 20px; color: var(--text-primary);">${message}</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="confirm-no" class="btn" style="flex: 1; background: var(--surface-elevated); color: var(--text-primary);">Cancelar</button>
          <button id="confirm-yes" class="btn btn-primary" style="flex: 1; background: var(--danger-color);">Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-yes').addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(true);
    });
    overlay.querySelector('#confirm-no').addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(false);
    });
  });
}

/**
 * Cria e exibe um modal de prompt in-app em vez de usar prompt() nativo
 * @param {string} message - Mensagem
 * @param {string|number} defaultValue - Valor padrão
 * @returns {Promise<string|null>} - valor digitado ou null se cancelado
 */
export function showPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8); display: flex; justify-content: center;
      align-items: center; z-index: 9999; padding: 20px;
    `;
    overlay.innerHTML = `
      <div style="background: var(--bg-color); border: 1px solid var(--glass-border);
        border-radius: var(--radius-md); padding: 24px; width: 100%; max-width: 360px;">
        <p style="font-size: 0.95rem; margin-bottom: 12px; color: var(--text-primary);">${message}</p>
        <input type="number" id="prompt-input" value="${defaultValue}" step="0.01"
          style="width: 100%; padding: 10px; border-radius: var(--radius-sm);
          border: 1px solid var(--glass-border); background: var(--surface-color);
          color: var(--text-primary); font-size: 1rem; margin-bottom: 16px;"
        />
        <div style="display: flex; gap: 10px;">
          <button id="prompt-cancel" class="btn" style="flex: 1; background: var(--surface-elevated); color: var(--text-primary);">Cancelar</button>
          <button id="prompt-ok" class="btn btn-primary" style="flex: 1;">Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#prompt-input');
    input.focus();
    input.select();

    overlay.querySelector('#prompt-ok').addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(input.value);
    });
    overlay.querySelector('#prompt-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(null);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { document.body.removeChild(overlay); resolve(input.value); }
      if (e.key === 'Escape') { document.body.removeChild(overlay); resolve(null); }
    });
  });
}

/**
 * Cria e gerencia o label de divisão (split) de despesa
 * Reutilizável em entrada, extrato e configuracoes
 */
export function updateSplitLabelEl(sliderEl, valEl, labelEl, user1Nome, user2Nome) {
  const percent2 = parseInt(sliderEl.value);
  const percent1 = 100 - percent2;
  const val = parseFloat(valEl || '0');

  if (val > 0) {
    const v1 = val * (percent1 / 100);
    const v2 = val * (percent2 / 100);
    labelEl.innerHTML = `${user1Nome}: <span style="color:var(--text-primary)">${f.format(v1)}</span> | ${user2Nome}: <span style="color:var(--text-primary)">${f.format(v2)}</span>`;
  } else {
    labelEl.textContent = `${percent1}% ${user1Nome} / ${percent2}% ${user2Nome}`;
  }
}

/**
 * Desabilita um botão durante uma operação assíncrona para evitar duplo clique
 */
export async function withLoading(btn, asyncFn) {
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span style="opacity: 0.7">⏳ Aguarde...</span>`;
  try {
    await asyncFn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}
