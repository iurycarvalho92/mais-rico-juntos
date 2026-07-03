import { db } from '../db.js';
import { f, getCurrentMonthStr, showConfirm } from '../utils.js';

export async function renderConfiguracoes(container) {
  container.innerHTML = `<div style="text-align: center; padding: 20px;">Carregando...</div>`;
  
  // ✅ FIX: Promise.all em paralelo
  const [users, categorias, receitas, despesas] = await Promise.all([
    db.getTable('utilizadores'),
    db.getTable('categorias'),
    db.getTable('receitas_fixas'),
    db.getTable('despesas_fixas')
  ]);
  
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const catMap = Object.fromEntries(categorias.map(c => [c.id, c]));
  
  const html = `
    <h2 style="margin-bottom: 20px;">Configurações</h2>
    
    <!-- Receitas Fixas (Salários) -->
    <div class="card">
      <h3 style="margin-bottom: 10px;">Salários / Receitas Fixas</h3>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;">
        ${receitas.length === 0 ? `<div class="text-muted" style="font-size: 0.85rem;">Nenhum salário configurado.</div>` : ''}
        ${receitas.map(r => `
          <div class="flex-between" style="background: var(--surface-elevated); padding: 10px; border-radius: var(--radius-sm); font-size: 0.85rem;">
            <div>
              <div style="font-weight: 600;">${r.descricao}</div>
              <div style="color: var(--text-secondary);">Dia ${r.dia_recebimento} • ${userMap[r.utilizador_id]?.nome}</div>
            </div>
            <div style="text-align: right;">
              <div style="color: var(--success-color); font-weight: 600;">${f.format(r.valor_estimado)}</div>
              <button class="btn-del-receita" data-id="${r.id}" style="background:none; border:none; color:var(--danger-color); cursor:pointer; font-size:0.75rem; margin-top:2px;">Remover</button>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: var(--radius-sm);">
        <input type="text" id="rec-desc" placeholder="Ex: Salário Iury" style="margin-bottom: 5px; font-size: 0.85rem; padding: 8px;" />
        <div class="flex-between" style="gap: 5px; margin-bottom: 5px;">
          <input type="number" id="rec-val" placeholder="Valor (R$)" style="font-size: 0.85rem; padding: 8px;" />
          <input type="number" id="rec-dia" placeholder="Dia (1-28)" min="1" max="28" style="font-size: 0.85rem; padding: 8px;" />
        </div>
        <select id="rec-user" style="margin-bottom: 10px; font-size: 0.85rem; padding: 8px;">
          ${users.map(u => `<option value="${u.id}">${u.nome}</option>`).join('')}
        </select>
        <div id="rec-error" style="color: var(--danger-color); font-size: 0.8rem; margin-bottom: 5px; display: none;"></div>
        <button id="btn-add-rec" class="btn btn-primary" style="padding: 8px; font-size: 0.85rem;">Adicionar Salário</button>
      </div>
    </div>
    
    <!-- Contas Fixas -->
    <div class="card">
      <h3 style="margin-bottom: 10px;">Contas Fixas (Recorrentes)</h3>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;">
        ${despesas.length === 0 ? `<div class="text-muted" style="font-size: 0.85rem;">Nenhuma conta fixa.</div>` : ''}
        ${despesas.map(d => `
          <div class="flex-between" style="background: var(--surface-elevated); padding: 10px; border-radius: var(--radius-sm); font-size: 0.85rem;">
            <div>
              <div style="font-weight: 600;">${catMap[d.categoria_id]?.icone} ${d.descricao}</div>
              <div style="color: var(--text-secondary);">Vence dia ${d.dia_vencimento} • ${userMap[d.pago_por_padrao]?.nome} paga</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 600;">${f.format(d.valor_estimado)}</div>
              <button class="btn-del-despesa" data-id="${d.id}" style="background:none; border:none; color:var(--danger-color); cursor:pointer; font-size:0.75rem; margin-top:2px;">Remover</button>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: var(--radius-sm);">
        <input type="text" id="des-desc" placeholder="Ex: Aluguel, Internet..." style="margin-bottom: 5px; font-size: 0.85rem; padding: 8px;" />
        <div class="flex-between" style="gap: 5px; margin-bottom: 5px;">
          <input type="number" id="des-val" placeholder="Estimativa (R$)" style="font-size: 0.85rem; padding: 8px;" />
          <input type="number" id="des-dia" placeholder="Dia (1-28)" min="1" max="28" style="font-size: 0.85rem; padding: 8px;" />
        </div>
        <div class="flex-between" style="gap: 5px; margin-bottom: 5px;">
          <select id="des-cat" style="font-size: 0.85rem; padding: 8px;">
            ${categorias.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('')}
          </select>
          <select id="des-user" style="font-size: 0.85rem; padding: 8px;">
            ${users.map(u => `<option value="${u.id}">${u.nome}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom: 10px;">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 2px;">Divisão da Conta</div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${users[0]?.nome || 'A'}</span>
            <input type="range" id="des-split" min="0" max="100" value="50" style="flex: 1;" />
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${users[1]?.nome || 'B'}</span>
          </div>
          <div id="des-split-label" style="font-size: 0.75rem; font-weight: bold; color: var(--primary-color); text-align: center; margin-top: 2px;">50% / 50%</div>
        </div>
        <div id="des-error" style="color: var(--danger-color); font-size: 0.8rem; margin-bottom: 5px; display: none;"></div>
        <button id="btn-add-des" class="btn btn-primary" style="padding: 8px; font-size: 0.85rem;">Adicionar Conta Fixa</button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  const splitSlider = document.getElementById('des-split');
  const splitLabel = document.getElementById('des-split-label');
  const desValInput = document.getElementById('des-val');
  
  // ✅ FIX: Split label sem duplicação (usa a mesma lógica)
  function updateConfigSplitLabel() {
    const percent2 = parseInt(splitSlider.value);
    const percent1 = 100 - percent2;
    const val = parseFloat(desValInput.value || '0');
    if (val > 0) {
      splitLabel.innerHTML = `${users[0]?.nome || 'A'}: ${f.format(val * (percent1/100))} | ${users[1]?.nome || 'B'}: ${f.format(val * (percent2/100))}`;
    } else {
      splitLabel.textContent = `${percent1}% / ${percent2}%`;
    }
  }
  
  splitSlider.addEventListener('input', updateConfigSplitLabel);
  desValInput.addEventListener('input', updateConfigSplitLabel);

  document.getElementById('btn-add-rec').addEventListener('click', async () => {
    const desc = document.getElementById('rec-desc').value.trim();
    const val = parseFloat(document.getElementById('rec-val').value);
    const dia = parseInt(document.getElementById('rec-dia').value);
    const user = document.getElementById('rec-user').value;
    const errDiv = document.getElementById('rec-error');
    
    // ✅ FIX: Validação com feedback visual (não silenciosa)
    if (!desc || isNaN(val) || val <= 0 || isNaN(dia) || dia < 1 || dia > 28) {
      errDiv.textContent = 'Preencha todos os campos. Dia deve ser entre 1 e 28.';
      errDiv.style.display = 'block';
      return;
    }
    errDiv.style.display = 'none';
    
    const currentMonthStr = getCurrentMonthStr();
    
    await db.insert('receitas_fixas', { 
      descricao: desc, valor_estimado: val, dia_recebimento: dia, 
      utilizador_id: user, ultimo_mes_gerado: currentMonthStr
    });
    
    const dataVencimento = `${currentMonthStr}-${String(dia).padStart(2, '0')}`;
    await db.insert('lancamentos_mes', {
      valor: val, data_vencimento: dataVencimento, categoria_id: null,
      descricao_custom: desc, tipo_lancamento: 'RECEITA',
      pago_por: user, regra_divisao: 'INDIVIDUAL', status: 'PENDENTE'
    });
    
    renderConfiguracoes(container);
  });

  document.getElementById('btn-add-des').addEventListener('click', async () => {
    const desc = document.getElementById('des-desc').value.trim();
    const val = parseFloat(document.getElementById('des-val').value);
    const dia = parseInt(document.getElementById('des-dia').value);
    const cat = document.getElementById('des-cat').value;
    const user = document.getElementById('des-user').value;
    const split = document.getElementById('des-split').value;
    const errDiv = document.getElementById('des-error');
    
    // ✅ FIX: Validação com feedback visual
    if (!desc || isNaN(val) || val <= 0 || isNaN(dia) || dia < 1 || dia > 28) {
      errDiv.textContent = 'Preencha todos os campos. Dia deve ser entre 1 e 28.';
      errDiv.style.display = 'block';
      return;
    }
    errDiv.style.display = 'none';
    
    const currentMonthStr = getCurrentMonthStr();
    
    await db.insert('despesas_fixas', { 
      descricao: desc, valor_estimado: val, dia_vencimento: dia, 
      categoria_id: parseInt(cat), pago_por_padrao: user, 
      regra_divisao_percent: parseInt(split), ultimo_mes_gerado: currentMonthStr
    });
    
    const dataVencimento = `${currentMonthStr}-${String(dia).padStart(2, '0')}`;
    await db.insert('lancamentos_mes', {
      valor: val, data_vencimento: dataVencimento, categoria_id: parseInt(cat),
      descricao_custom: desc, tipo_lancamento: 'DESPESA_FIXA',
      pago_por: user, regra_divisao_percent: parseInt(split), status: 'PENDENTE'
    });
    
    renderConfiguracoes(container);
  });

  // ✅ FIX: showConfirm modal em vez de confirm() nativo
  container.querySelectorAll('.btn-del-receita').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await showConfirm('Remover este salário? O histórico de lançamentos permanecerá.');
      if (confirmed) {
        await db.delete('receitas_fixas', btn.dataset.id);
        renderConfiguracoes(container);
      }
    });
  });

  container.querySelectorAll('.btn-del-despesa').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await showConfirm('Remover esta conta fixa? O histórico de lançamentos permanecerá.');
      if (confirmed) {
        await db.delete('despesas_fixas', btn.dataset.id);
        renderConfiguracoes(container);
      }
    });
  });
}
