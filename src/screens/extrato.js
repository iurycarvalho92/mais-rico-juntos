import { db } from '../db.js';

export async function renderExtrato(container) {
  let currentFilter = 'TODOS'; // TODOS, PENDENTES, PAGOS
  
  // Re-render function to handle state changes
  async function render() {
    container.innerHTML = `<div style="text-align: center; padding: 20px;">A carregar...</div>`;
    
    const lancamentos = await db.getTable('lancamentos_mes');
    const users = await db.getTable('utilizadores');
    const categorias = await db.getTable('categorias');
    
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const catMap = Object.fromEntries(categorias.map(c => [c.id, c]));
    
    // Sort by date (descending)
    lancamentos.sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento));
    
    // Filter
    const filtered = lancamentos.filter(l => {
      if (currentFilter === 'TODOS') return true;
      if (currentFilter === 'PENDENTES') return l.status === 'PENDENTE';
      if (currentFilter === 'PAGOS') return l.status === 'PAGO';
      return true;
    });

    const f = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

    const html = `
      <!-- Filters -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">
        <button class="filter-btn ${currentFilter === 'TODOS' ? 'active' : ''}" data-filter="TODOS">Todos</button>
        <button class="filter-btn ${currentFilter === 'PENDENTES' ? 'active' : ''}" data-filter="PENDENTES">Pendentes</button>
        <button class="filter-btn ${currentFilter === 'PAGOS' ? 'active' : ''}" data-filter="PAGOS">Pagos</button>
      </div>
      
      <!-- List -->
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${filtered.length === 0 ? `<div class="text-muted" style="text-align:center; padding: 20px;">Nenhum lançamento encontrado.</div>` : ''}
        ${filtered.map(l => {
          const isReceita = l.tipo_lancamento === 'RECEITA';
          const icon = isReceita ? '💰' : (catMap[l.categoria_id]?.icone || '📄');
          const valueColor = isReceita ? 'var(--success-color)' : 'var(--text-primary)';
          const paidBy = isReceita ? 'Recebido por' : 'Pago por';
          const userName = userMap[l.pago_por]?.nome || '?';
          
          return `
            <div class="card" style="margin-bottom:0; display: flex; align-items: center; gap: 12px; padding: 12px; opacity: ${l.status === 'PAGO' ? '0.7' : '1'}">
              <div style="font-size: 1.5rem; background: var(--surface-elevated); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm);">
                ${icon}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${l.descricao_custom}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); display: flex; gap: 8px;">
                  <span>${l.data_vencimento}</span>
                  <span>•</span>
                  <span>${paidBy} ${userName}</span>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 600; color: ${valueColor}">${f.format(l.valor)}</div>
                ${l.status === 'PENDENTE' ? `
                  <button class="pay-btn" data-id="${l.id}" style="margin-top: 4px; background: var(--success-color); color: white; border: none; border-radius: 4px; padding: 2px 8px; font-size: 0.7rem; cursor: pointer;">
                    ✓ Pagar
                  </button>
                ` : `
                  <div style="font-size: 0.7rem; color: var(--success-color); margin-top: 4px;">✔ Pago</div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.innerHTML = html;

    // Filter Styles (inject dynamically or use existing css, we will add inline for simplicity here or add to style.css later)
    const style = document.createElement('style');
    style.innerHTML = `
      .filter-btn {
        padding: 6px 16px;
        border-radius: 20px;
        background: var(--surface-elevated);
        border: 1px solid var(--glass-border);
        color: var(--text-primary);
        font-family: inherit;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }
      .filter-btn.active {
        background: var(--primary-color);
        border-color: var(--primary-color);
      }
      .pay-btn:active {
        transform: scale(0.95);
      }
    `;
    container.prepend(style);

    // Event Listeners
    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentFilter = e.target.dataset.filter;
        render();
      });
    });

    container.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        await db.update('lancamentos_mes', id, { status: 'PAGO' });
        render(); // re-render
      });
    });
  }

  await render();
}
