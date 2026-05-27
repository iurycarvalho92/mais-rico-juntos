import { db } from '../db.js';

export async function renderConfiguracoes(container) {
  container.innerHTML = `<div style="text-align: center; padding: 20px;">Carregando...</div>`;
  
  const users = await db.getTable('utilizadores');
  const categorias = await db.getTable('categorias');
  const receitas = await db.getTable('receitas_fixas');
  const despesas = await db.getTable('despesas_fixas');
  
  const f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
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
          <input type="number" id="rec-dia" placeholder="Dia (1-31)" min="1" max="31" style="font-size: 0.85rem; padding: 8px;" />
        </div>
        <select id="rec-user" style="margin-bottom: 10px; font-size: 0.85rem; padding: 8px;">
          ${users.map(u => `<option value="${u.id}">${u.nome}</option>`).join('')}
        </select>
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
          <input type="number" id="des-dia" placeholder="Dia (1-31)" min="1" max="31" style="font-size: 0.85rem; padding: 8px;" />
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
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${users[0].nome.charAt(0)}</span>
            <input type="range" id="des-split" min="0" max="100" value="50" style="flex: 1;" />
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${users[1].nome.charAt(0)}</span>
          </div>
          <div id="des-split-label" style="font-size: 0.75rem; font-weight: bold; color: var(--primary-color); text-align: center; margin-top: 2px;">50% / 50%</div>
        </div>
        <button id="btn-add-des" class="btn btn-primary" style="padding: 8px; font-size: 0.85rem;">Adicionar Conta Fixa</button>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Logic
  const splitSlider = document.getElementById('des-split');
  const splitLabel = document.getElementById('des-split-label');
  const desValInput = document.getElementById('des-val');
  
  function updateConfigSplitLabel() {
    const percent2 = parseInt(splitSlider.value);
    const percent1 = 100 - percent2;
    const val = parseFloat(desValInput.value || '0');
    
    if (val > 0) {
      const v1 = val * (percent1 / 100);
      const v2 = val * (percent2 / 100);
      splitLabel.innerHTML = `${users[0].nome}: ${f.format(v1)} | ${users[1].nome}: ${f.format(v2)}`;
    } else {
      splitLabel.textContent = `${percent1}% ${users[0].nome} / ${percent2}% ${users[1].nome}`;
    }
  }
  
  splitSlider.addEventListener('input', updateConfigSplitLabel);
  desValInput.addEventListener('input', updateConfigSplitLabel);

  document.getElementById('btn-add-rec').addEventListener('click', async () => {
    const desc = document.getElementById('rec-desc').value.trim();
    const val = parseFloat(document.getElementById('rec-val').value);
    const dia = parseInt(document.getElementById('rec-dia').value);
    const user = document.getElementById('rec-user').value;
    
    if (desc && val > 0 && dia >= 1 && dia <= 31) {
      await db.insert('receitas_fixas', { descricao: desc, valor_estimado: val, dia_recebimento: dia, utilizador_id: user });
      renderConfiguracoes(container);
    }
  });

  document.getElementById('btn-add-des').addEventListener('click', async () => {
    const desc = document.getElementById('des-desc').value.trim();
    const val = parseFloat(document.getElementById('des-val').value);
    const dia = parseInt(document.getElementById('des-dia').value);
    const cat = document.getElementById('des-cat').value;
    const user = document.getElementById('des-user').value;
    const split = document.getElementById('des-split').value;
    
    if (desc && val > 0 && dia >= 1 && dia <= 31) {
      await db.insert('despesas_fixas', { 
        descricao: desc, valor_estimado: val, dia_vencimento: dia, 
        categoria_id: parseInt(cat), pago_por_padrao: user, regra_divisao_percent: parseInt(split) 
      });
      renderConfiguracoes(container);
    }
  });

  container.querySelectorAll('.btn-del-receita').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if(confirm('Remover salário?')) {
        await db.delete('receitas_fixas', e.target.dataset.id);
        renderConfiguracoes(container);
      }
    });
  });

  container.querySelectorAll('.btn-del-despesa').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if(confirm('Remover conta fixa?')) {
        await db.delete('despesas_fixas', e.target.dataset.id);
        renderConfiguracoes(container);
      }
    });
  });
}
