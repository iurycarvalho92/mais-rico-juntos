import { db } from '../db.js';

export async function renderExtrato(container) {
  let activeFilter = 'TODOS';
  let viewDate = new Date();
  
  async function render() {
    container.innerHTML = `<div style="text-align: center; padding: 20px;">Carregando...</div>`;
    
    const lancamentosRaw = await db.getTable('lancamentos_mes');
    const categorias = await db.getTable('categorias');
    const users = await db.getTable('utilizadores');
    
    const catMap = Object.fromEntries(categorias.map(c => [c.id, c]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    
    // Sort by date descending
    lancamentosRaw.sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento));
    
    const viewMonthStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const monthName = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    
    const lancamentos = lancamentosRaw.filter(l => {
      // Month filter
      if (!l.data_vencimento.startsWith(viewMonthStr)) return false;
      
      // Status filter
      if (activeFilter === 'PENDENTE') return l.status === 'PENDENTE';
      if (activeFilter === 'PAGO') return l.status === 'PAGO';
      return true;
    });

    const f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    const html = `
      <style>
        .month-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--surface-elevated);
          padding: 10px 15px;
          border-radius: var(--radius-sm);
          margin-bottom: 15px;
        }
        .nav-arrow {
          background: none;
          border: none;
          color: var(--primary-color);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0 10px;
        }
        
        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-content {
          background: var(--bg-color);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          padding: 20px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .form-group {
          margin-bottom: 15px;
        }
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        .form-group input, .form-group select {
          width: 100%;
          padding: 10px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--glass-border);
          background: var(--surface-color);
          color: var(--text-primary);
        }
      </style>

      <!-- Month Navigation -->
      <div class="month-nav">
        <button class="nav-arrow" id="btn-prev-month">❮</button>
        <h3 style="margin: 0; font-size: 1.1rem;">${capitalizedMonth}</h3>
        <button class="nav-arrow" id="btn-next-month">❯</button>
      </div>

      <!-- Filters -->
      <div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">
        <button class="btn btn-filter ${activeFilter === 'TODOS' ? 'active' : ''}" data-filter="TODOS" style="background: ${activeFilter === 'TODOS' ? 'var(--primary-color)' : 'var(--surface-elevated)'}; color: ${activeFilter === 'TODOS' ? '#fff' : 'var(--text-primary)'}; padding: 8px 16px; border-radius: 20px; border: none; font-size: 0.85rem; cursor: pointer; white-space: nowrap;">Todos</button>
        <button class="btn btn-filter ${activeFilter === 'PENDENTE' ? 'active' : ''}" data-filter="PENDENTE" style="background: ${activeFilter === 'PENDENTE' ? 'var(--warning-color)' : 'var(--surface-elevated)'}; color: ${activeFilter === 'PENDENTE' ? '#000' : 'var(--text-primary)'}; padding: 8px 16px; border-radius: 20px; border: none; font-size: 0.85rem; cursor: pointer; white-space: nowrap;">Pendentes</button>
        <button class="btn btn-filter ${activeFilter === 'PAGO' ? 'active' : ''}" data-filter="PAGO" style="background: ${activeFilter === 'PAGO' ? 'var(--success-color)' : 'var(--surface-elevated)'}; color: ${activeFilter === 'PAGO' ? '#fff' : 'var(--text-primary)'}; padding: 8px 16px; border-radius: 20px; border: none; font-size: 0.85rem; cursor: pointer; white-space: nowrap;">Pagos</button>
      </div>

      <!-- List -->
      <div style="display: flex; flex-direction: column; gap: 12px; padding-bottom: 80px;">
        ${lancamentos.length === 0 ? `<div style="text-align:center; color: var(--text-secondary); padding: 20px;">Nenhum lançamento neste mês.</div>` : ''}
        
        ${lancamentos.map(l => {
          const isReceita = l.tipo_lancamento === 'RECEITA';
          const cat = catMap[l.categoria_id];
          const valColor = isReceita ? 'var(--success-color)' : (l.status === 'PENDENTE' ? 'var(--warning-color)' : 'var(--text-primary)');
          const sign = isReceita ? '+' : '-';
          
          return `
            <div class="card" style="margin-bottom: 0; padding: 15px;">
              <div class="flex-between">
                <div style="display: flex; gap: 15px; align-items: center;">
                  <div style="font-size: 1.8rem;">${cat ? cat.icone : '💸'}</div>
                  <div>
                    <div style="font-weight: 600; font-size: 1rem;">${l.descricao_custom}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                      ${l.data_vencimento.split('-').reverse().join('/')} • ${userMap[l.pago_por]?.nome || 'Sistema'}
                    </div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: 700; color: ${valColor}; font-size: 1.1rem;">
                    ${sign} ${f.format(l.valor)}
                  </div>
                  <div style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); display: inline-block; margin-top: 4px; color: ${l.status === 'PENDENTE' ? 'var(--warning-color)' : 'var(--success-color)'}">
                    ${l.status}
                  </div>
                </div>
              </div>
              
              <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px; border-top: 1px solid var(--glass-border); padding-top: 10px;">
                <button class="btn-del" data-id="${l.id}" style="background: none; border: none; color: var(--danger-color); font-size: 0.85rem; cursor: pointer; padding: 5px;">Apagar</button>
                <button class="btn-edit" data-id="${l.id}" style="background: none; border: none; color: var(--primary-color); font-size: 0.85rem; cursor: pointer; padding: 5px;">Editar Tudo</button>
                
                ${l.status === 'PENDENTE' ? `
                  <button class="btn-pay" data-id="${l.id}" data-val="${l.valor}" style="background: var(--success-color); color: white; border: none; border-radius: 15px; font-size: 0.85rem; cursor: pointer; padding: 5px 15px; font-weight: 600;">✓ Confirmar Pagamento</button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      <!-- Edit Modal Container -->
      <div id="edit-modal-container"></div>
    `;

    container.innerHTML = html;

    // Month Navigation Listeners
    document.getElementById('btn-prev-month').addEventListener('click', () => {
      viewDate.setMonth(viewDate.getMonth() - 1);
      render();
    });
    
    document.getElementById('btn-next-month').addEventListener('click', () => {
      viewDate.setMonth(viewDate.getMonth() + 1);
      render();
    });

    // Filters
    container.querySelectorAll('.btn-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        activeFilter = e.target.dataset.filter;
        render();
      });
    });

    // Delete
    container.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if(confirm('Tem certeza que deseja apagar este lançamento?')) {
          await db.delete('lancamentos_mes', e.target.dataset.id);
          render();
        }
      });
    });

    // Edit Modal Logic
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const l = lancamentosRaw.find(x => String(x.id) === String(id));
        if (!l) return;
        
        const isReceita = l.tipo_lancamento === 'RECEITA';
        const defaultSplit = l.regra_divisao_percent !== undefined ? l.regra_divisao_percent : (l.regra_divisao === '100_USER_A' ? 0 : (l.regra_divisao === '100_USER_B' ? 100 : 50));
        
        const modalHtml = `
          <div class="modal-overlay" id="edit-modal">
            <div class="modal-content">
              <h3 style="margin-top: 0;">Editar Lançamento</h3>
              
              <div class="form-group">
                <label>Descrição</label>
                <input type="text" id="edit-desc" value="${l.descricao_custom}" />
              </div>
              
              <div class="form-group">
                <label>Valor (R$)</label>
                <input type="number" id="edit-val" value="${l.valor}" step="0.01" />
              </div>
              
              <div class="form-group">
                <label>Data</label>
                <input type="date" id="edit-date" value="${l.data_vencimento}" />
              </div>
              
              ${!isReceita ? `
                <div class="form-group">
                  <label>Categoria</label>
                  <select id="edit-cat">
                    ${categorias.map(c => `<option value="${c.id}" ${c.id === l.categoria_id ? 'selected' : ''}>${c.icone} ${c.nome}</option>`).join('')}
                  </select>
                </div>
              ` : ''}
              
              <div class="form-group">
                <label>Responsável / Pago por</label>
                <select id="edit-payer">
                  ${users.map(u => `<option value="${u.id}" ${u.id === l.pago_por ? 'selected' : ''}>${u.nome}</option>`).join('')}
                </select>
              </div>
              
              ${!isReceita ? `
                <div class="form-group">
                  <label>Divisão da Despesa</label>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 0.75rem;">${users[0].nome.charAt(0)}</span>
                    <input type="range" id="edit-split" min="0" max="100" value="${defaultSplit}" style="flex: 1;" />
                    <span style="font-size: 0.75rem;">${users[1].nome.charAt(0)}</span>
                  </div>
                </div>
              ` : ''}
              
              <div class="form-group">
                <label>Status</label>
                <select id="edit-status">
                  <option value="PAGO" ${l.status === 'PAGO' ? 'selected' : ''}>Pago</option>
                  <option value="PENDENTE" ${l.status === 'PENDENTE' ? 'selected' : ''}>Pendente</option>
                </select>
              </div>
              
              <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn" id="btn-cancel-edit" style="flex: 1; background: var(--surface-elevated); color: var(--text-primary);">Cancelar</button>
                <button class="btn btn-primary" id="btn-save-edit" style="flex: 1;">Salvar Alterações</button>
              </div>
            </div>
          </div>
        `;
        
        const modalContainer = document.getElementById('edit-modal-container');
        modalContainer.innerHTML = modalHtml;
        
        document.getElementById('btn-cancel-edit').addEventListener('click', () => {
          modalContainer.innerHTML = '';
        });
        
        document.getElementById('btn-save-edit').addEventListener('click', async () => {
          const updates = {
            descricao_custom: document.getElementById('edit-desc').value.trim(),
            valor: parseFloat(document.getElementById('edit-val').value),
            data_vencimento: document.getElementById('edit-date').value,
            pago_por: document.getElementById('edit-payer').value,
            status: document.getElementById('edit-status').value
          };
          
          if (!isReceita) {
            updates.categoria_id = parseInt(document.getElementById('edit-cat').value);
            updates.regra_divisao_percent = parseInt(document.getElementById('edit-split').value);
          }
          
          if (updates.descricao_custom && !isNaN(updates.valor) && updates.valor > 0) {
            await db.update('lancamentos_mes', id, updates);
            modalContainer.innerHTML = '';
            render();
          } else {
            alert("Preencha os campos corretamente.");
          }
        });
      });
    });

    // Pay with Confirmation
    container.querySelectorAll('.btn-pay').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const oldVal = parseFloat(e.target.dataset.val);
        const newValStr = prompt("O valor estimado era " + f.format(oldVal) + ".\nInsira o valor real final desta fatura (apenas números):", oldVal);
        
        if (newValStr !== null) {
          let newVal = parseFloat(newValStr.replace(',', '.'));
          if (!isNaN(newVal) && newVal > 0) {
            await db.update('lancamentos_mes', id, { status: 'PAGO', valor: newVal });
            render();
          }
        }
      });
    });
  }

  await render();
}
