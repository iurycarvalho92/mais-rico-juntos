import { db } from '../db.js';

export async function renderExtrato(container) {
  let activeFilter = 'TODOS';
  
  async function render() {
    container.innerHTML = `<div style="text-align: center; padding: 20px;">Carregando...</div>`;
    
    const lancamentosRaw = await db.getTable('lancamentos_mes');
    const categorias = await db.getTable('categorias');
    const users = await db.getTable('utilizadores');
    
    const catMap = Object.fromEntries(categorias.map(c => [c.id, c]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    
    // Sort by date descending
    lancamentosRaw.sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento));
    
    const lancamentos = lancamentosRaw.filter(l => {
      if (activeFilter === 'PENDENTE') return l.status === 'PENDENTE';
      if (activeFilter === 'PAGO') return l.status === 'PAGO';
      return true;
    });

    const f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    const html = `
      <!-- Filters -->
      <div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">
        <button class="btn btn-filter ${activeFilter === 'TODOS' ? 'active' : ''}" data-filter="TODOS" style="background: ${activeFilter === 'TODOS' ? 'var(--primary-color)' : 'var(--surface-elevated)'}; color: ${activeFilter === 'TODOS' ? '#fff' : 'var(--text-primary)'}; padding: 8px 16px; border-radius: 20px; border: none; font-size: 0.85rem; cursor: pointer; white-space: nowrap;">Todos</button>
        <button class="btn btn-filter ${activeFilter === 'PENDENTE' ? 'active' : ''}" data-filter="PENDENTE" style="background: ${activeFilter === 'PENDENTE' ? 'var(--warning-color)' : 'var(--surface-elevated)'}; color: ${activeFilter === 'PENDENTE' ? '#000' : 'var(--text-primary)'}; padding: 8px 16px; border-radius: 20px; border: none; font-size: 0.85rem; cursor: pointer; white-space: nowrap;">Pendentes</button>
        <button class="btn btn-filter ${activeFilter === 'PAGO' ? 'active' : ''}" data-filter="PAGO" style="background: ${activeFilter === 'PAGO' ? 'var(--success-color)' : 'var(--surface-elevated)'}; color: ${activeFilter === 'PAGO' ? '#fff' : 'var(--text-primary)'}; padding: 8px 16px; border-radius: 20px; border: none; font-size: 0.85rem; cursor: pointer; white-space: nowrap;">Pagos</button>
      </div>

      <!-- List -->
      <div style="display: flex; flex-direction: column; gap: 12px; padding-bottom: 80px;">
        ${lancamentos.length === 0 ? `<div style="text-align:center; color: var(--text-secondary); padding: 20px;">Nenhum lançamento encontrado.</div>` : ''}
        
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
                <button class="btn-edit" data-id="${l.id}" data-val="${l.valor}" data-desc="${l.descricao_custom}" style="background: none; border: none; color: var(--primary-color); font-size: 0.85rem; cursor: pointer; padding: 5px;">Editar Valor/Nome</button>
                
                ${l.status === 'PENDENTE' ? `
                  <button class="btn-pay" data-id="${l.id}" data-val="${l.valor}" style="background: var(--success-color); color: white; border: none; border-radius: 15px; font-size: 0.85rem; cursor: pointer; padding: 5px 15px; font-weight: 600;">✓ Confirmar Pagamento</button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.innerHTML = html;

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

    // Edit
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const oldDesc = e.target.dataset.desc;
        const oldVal = parseFloat(e.target.dataset.val);
        
        const newDesc = prompt("Nova descrição:", oldDesc);
        if (newDesc !== null) {
          const newValStr = prompt("Novo valor (apenas números):", oldVal);
          if (newValStr !== null) {
            let newVal = parseFloat(newValStr.replace(',', '.'));
            if (!isNaN(newVal)) {
              await db.update('lancamentos_mes', id, { descricao_custom: newDesc, valor: newVal });
              render();
            }
          }
        }
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
