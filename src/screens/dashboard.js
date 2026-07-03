import { db } from '../db.js';
import { f, getCurrentMonthStr } from '../utils.js';

export async function renderDashboard(container) {
  let daysToProject = 30;
  
  async function render() {
    container.innerHTML = `<div style="text-align: center; padding: 20px;">Carregando...</div>`;
    
    // ✅ FIX: Promise.all para carregar em paralelo (~5x mais rápido)
    const [lancamentos, users, categorias, receitas, despesas] = await Promise.all([
      db.getTable('lancamentos_mes'),
      db.getTable('utilizadores'),
      db.getTable('categorias'),
      db.getTable('receitas_fixas'),
      db.getTable('despesas_fixas')
    ]);
    
    // ✅ FIX: Validação de usuários antes de usar
    if (!users || users.length < 2) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--danger-color);">
          <div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
          <h3>Usuários não encontrados</h3>
          <p style="color: var(--text-secondary); margin-top: 10px;">Verifique sua conexão e recarregue o app.</p>
          <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 20px;">Recarregar</button>
        </div>
      `;
      return;
    }
    
    const catMap = Object.fromEntries(categorias.map(c => [c.id, c]));
    
    let receitasPrevistas = 0;
    let custosFixos = 0;
    let gastoVariavel = 0;
    
    let u1Balance = 0;
    const u1Id = users[0].id;
    const u2Id = users[1].id;
    
    let gastoU1 = 0;
    let gastoU2 = 0;
    let pendenciasAnteriores = 0;
    let futuroU1 = 0;
    let futuroU2 = 0;
    
    const currentDate = new Date();
    currentDate.setHours(0,0,0,0);
    // ✅ FIX: Usar getCurrentMonthStr() para evitar bug de fuso horário
    const currentMonthStr = getCurrentMonthStr();
    
    const lembretes = [];
    
    for (const l of lancamentos) {
      const val = parseFloat(l.valor);
      
      // ✅ FIX: Comparação correta com "-01" em vez de "-00"
      if (l.status === 'PENDENTE' && l.tipo_lancamento !== 'RECEITA' && l.data_vencimento < currentMonthStr + "-01") {
        pendenciasAnteriores += val;
      }
      
      const isFutureMonth = l.data_vencimento.substring(0, 7) > currentMonthStr;
      if (l.status === 'PENDENTE' && l.tipo_lancamento !== 'RECEITA' && l.tipo_lancamento !== 'TRANSFERENCIA' && isFutureMonth) {
        if (l.pago_por === u1Id) {
          futuroU1 += val;
        } else if (l.pago_por === u2Id) {
          futuroU2 += val;
        }
      }
      
      if (l.data_vencimento.startsWith(currentMonthStr)) {
        if (l.tipo_lancamento === 'RECEITA') receitasPrevistas += val;
        else if (l.tipo_lancamento === 'DESPESA_FIXA') custosFixos += val;
        else if (l.tipo_lancamento !== 'TRANSFERENCIA') gastoVariavel += val;
        
        if (l.tipo_lancamento !== 'RECEITA' && l.tipo_lancamento !== 'TRANSFERENCIA') {
          if (l.pago_por === u1Id) gastoU1 += val;
          else if (l.pago_por === u2Id) gastoU2 += val;
        }
      }
      
      if (l.tipo_lancamento !== 'RECEITA' && l.status === 'PAGO') {
        let u1Share = 0; let u2Share = 0;
        
        if (l.regra_divisao_percent !== undefined) {
           const p2 = parseInt(l.regra_divisao_percent);
           const p1 = 100 - p2;
           u1Share = val * (p1 / 100);
           u2Share = val * (p2 / 100);
        } else {
          if (l.regra_divisao === '50_50') { u1Share = val / 2; u2Share = val / 2; }
          else if (l.regra_divisao === '100_USER_A') u1Share = val;
          else if (l.regra_divisao === '100_USER_B') u2Share = val;
        }
        
        if (l.pago_por === u1Id) u1Balance += u2Share;
        else if (l.pago_por === u2Id) u1Balance -= u1Share;
      }
      
      if (l.status === 'PENDENTE' && l.tipo_lancamento !== 'RECEITA') {
        const vDate = new Date(l.data_vencimento + 'T12:00:00');
        vDate.setHours(0,0,0,0);
        const diffTime = vDate - currentDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays <= 5 && l.data_vencimento.startsWith(currentMonthStr)) {
          lembretes.push({ ...l, diffDays });
        }
      }
    }
    
    const dinheiroLivre = receitasPrevistas - custosFixos - gastoVariavel;
    
    // Gastos por categoria (mês atual)
    const catTotals = {};
    for (const l of lancamentos) {
      if (!l.data_vencimento.startsWith(currentMonthStr)) continue;
      if (l.tipo_lancamento === 'RECEITA' || l.tipo_lancamento === 'TRANSFERENCIA') continue;
      const cid = l.categoria_id;
      if (!catTotals[cid]) catTotals[cid] = 0;
      catTotals[cid] += parseFloat(l.valor);
    }
    const sortedCategories = Object.entries(catTotals)
      .map(([id, total]) => ({ cat: catMap[id], total }))
      .sort((a, b) => b.total - a.total);
    
    // Cash Flow Projection
    const today = new Date();
    today.setHours(0,0,0,0);
    const projectionDays = [];
    let runningBalance = 0;
    
    for (let i = 0; i <= daysToProject; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      
      for (const l of lancamentos) {
        if (l.data_vencimento === dStr) {
          const val = parseFloat(l.valor);
          if (l.tipo_lancamento === 'RECEITA') runningBalance += val;
          else if (l.tipo_lancamento !== 'TRANSFERENCIA') runningBalance -= val;
        }
      }
      
      for (const r of receitas) {
        const recDia = String(r.dia_recebimento).padStart(2, '0');
        const recMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (recMonth > currentMonthStr && `${recMonth}-${recDia}` === dStr) {
          runningBalance += r.valor_estimado;
        }
      }
      
      for (const des of despesas) {
        const desDia = String(des.dia_vencimento).padStart(2, '0');
        const desMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (desMonth > currentMonthStr && `${desMonth}-${desDia}` === dStr) {
          runningBalance -= des.valor_estimado;
        }
      }
      
      projectionDays.push({ date: dStr, balance: runningBalance });
    }
    
    const balances = projectionDays.map(p => p.balance);
    const minBal = Math.min(0, ...balances);
    const maxBal = Math.max(1, ...balances);
    const range = maxBal - minBal || 1;
    const svgHeight = 150;
    const svgWidth = 300;
    const points = projectionDays.map((p, i) => {
      const x = (i / daysToProject) * svgWidth;
      const y = svgHeight - ((p.balance - minBal) / range) * svgHeight;
      return `${x},${y}`;
    }).join(' ');
    
    const u1BalanceAbs = Math.abs(u1Balance);
    const devedor = u1Balance > 0 ? users[1] : users[0];
    const credor = u1Balance > 0 ? users[0] : users[1];

    const html = `
      <!-- Saldo Geral -->
      <div class="card" style="background: ${u1Balance === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border-color: ${u1Balance === 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
        <div class="flex-between">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 5px;">Saldo entre o casal</div>
            <div style="font-size: 1.6rem; font-weight: 700; color: ${u1Balance === 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
              ${u1Balance === 0 ? '✅ Tudo quitado!' : `${devedor.nome} deve ${f.format(u1BalanceAbs)}`}
            </div>
            ${u1Balance !== 0 ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 3px;">a ${credor.nome}</div>` : ''}
          </div>
          ${u1Balance !== 0 ? `<button id="btn-quitar" class="btn btn-primary" style="width: auto; padding: 8px 16px; font-size: 0.85rem; border-radius: 20px;">💸 Quitar</button>` : ''}
        </div>
      </div>
      
      ${pendenciasAnteriores > 0 ? `
      <div class="card" style="background: rgba(239,68,68,0.1); border-color: var(--danger-color); margin-bottom: 0;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.5rem;">⚠️</span>
          <div>
            <div style="font-weight: 600; font-size: 0.9rem;">Contas vencidas de meses anteriores</div>
            <div style="color: var(--danger-color); font-weight: 700;">${f.format(pendenciasAnteriores)}</div>
          </div>
        </div>
      </div>
      ` : ''}
      
      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <div class="card" style="margin-bottom: 0; padding: 15px;">
          <div style="font-size: 0.75rem; color: var(--text-secondary);">Receitas do Mês</div>
          <div style="font-size: 1.3rem; font-weight: 700; color: var(--success-color);">${f.format(receitasPrevistas)}</div>
        </div>
        <div class="card" style="margin-bottom: 0; padding: 15px;">
          <div style="font-size: 0.75rem; color: var(--text-secondary);">Custos Fixos</div>
          <div style="font-size: 1.3rem; font-weight: 700; color: var(--danger-color);">${f.format(custosFixos)}</div>
        </div>
        <div class="card" style="margin-bottom: 0; padding: 15px;">
          <div style="font-size: 0.75rem; color: var(--text-secondary);">Gastos Variáveis</div>
          <div style="font-size: 1.3rem; font-weight: 700; color: var(--warning-color);">${f.format(gastoVariavel)}</div>
        </div>
        <div class="card" style="margin-bottom: 0; padding: 15px; background: ${dinheiroLivre >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border-color: ${dinheiroLivre >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
          <div style="font-size: 0.75rem; color: var(--text-secondary);">Livre Previsto</div>
          <div style="font-size: 1.3rem; font-weight: 700; color: ${dinheiroLivre >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">${f.format(dinheiroLivre)}</div>
        </div>
      </div>
      
      <!-- Lembretes -->
      ${lembretes.length > 0 ? `
      <div class="card" style="background: rgba(245,158,11,0.1); border-color: var(--warning-color); padding: 15px;">
        <h3 style="font-size: 0.9rem; color: var(--warning-color); margin-bottom: 10px;">🔔 Vencendo em breve</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${lembretes.map(l => `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 8px; background: rgba(0,0,0,0.2); border-radius: var(--radius-sm);">
              <div>
                <div style="font-weight: 600;">${l.descricao_custom}</div>
                <div style="color: var(--text-secondary); font-size: 0.75rem;">${l.diffDays === 0 ? 'Vence hoje!' : `em ${l.diffDays} dia(s)`}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 700; color: var(--warning-color);">${f.format(l.valor)}</div>
                <button class="btn-lembrete-pay" data-id="${l.id}" data-val="${l.valor}" style="background: var(--success-color); color: white; border: none; border-radius: 10px; font-size: 0.75rem; padding: 3px 10px; cursor: pointer; margin-top: 4px;">✓ Pagar</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      
      <!-- Charts Section -->
      <div class="card" style="padding: 15px; margin: 0;">
        <div class="card" style="padding: 15px; margin: 0 0 15px 0;">
          <h3 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 10px;">Quem Pagou Mais Este Mês (Tirou do Bolso)</h3>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
            <div style="font-weight: 600; color: var(--primary-color);">${users[0].nome} (${f.format(gastoU1)})</div>
            <div style="font-weight: 600; color: var(--success-color);">${users[1].nome} (${f.format(gastoU2)})</div>
          </div>
          <div style="width: 100%; height: 12px; background: var(--bg-color); border-radius: 6px; overflow: hidden; display: flex;">
            <div style="height: 100%; width: ${(gastoU1 / (gastoU1 + gastoU2 || 1)) * 100}%; background: var(--primary-color);"></div>
            <div style="height: 100%; width: ${(gastoU2 / (gastoU1 + gastoU2 || 1)) * 100}%; background: var(--success-color);"></div>
          </div>
        </div>
        
        <div class="card" style="padding: 15px; margin: 0;">
          <h3 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 10px;">Compromissos Futuros (Quem Vai Pagar)</h3>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;">
            <div style="font-weight: 600; color: var(--primary-color);">${users[0].nome} (${f.format(futuroU1)})</div>
            <div style="font-weight: 600; color: var(--success-color);">${users[1].nome} (${f.format(futuroU2)})</div>
          </div>
          <div style="width: 100%; height: 12px; background: var(--bg-color); border-radius: 6px; overflow: hidden; display: flex;">
            <div style="height: 100%; width: ${(futuroU1 / (futuroU1 + futuroU2 || 1)) * 100}%; background: var(--primary-color); opacity: 0.8;"></div>
            <div style="height: 100%; width: ${(futuroU2 / (futuroU1 + futuroU2 || 1)) * 100}%; background: var(--success-color); opacity: 0.8;"></div>
          </div>
        </div>
      </div>
      
      <!-- Category Breakdown -->
      ${sortedCategories.length > 0 ? `
      <div class="card" style="margin-bottom: 20px; padding: 15px;">
        <h3 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 10px;">Gastos por Categoria (Mês Atual)</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${sortedCategories.map(c => {
             const percentage = ((c.total / (custosFixos + gastoVariavel || 1)) * 100).toFixed(1);
             return `
               <div class="category-item" data-id="${c.cat?.id}" style="cursor: pointer; padding: 4px; border-radius: 4px; transition: background 0.2s;">
                 <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                   <div style="display: flex; align-items: center; gap: 8px;">
                     <span style="font-size: 1.1rem;">${c.cat?.icone || '❓'}</span>
                     <span>${c.cat?.nome || 'Sem Categoria'}</span>
                   </div>
                   <div style="display: flex; align-items: center; gap: 10px;">
                     <span style="font-weight: 600;">${f.format(c.total)}</span>
                     <span style="color: var(--text-secondary); font-size: 0.75rem; width: 35px; text-align: right;">${percentage}%</span>
                   </div>
                 </div>
                 <div style="width: 100%; height: 6px; background: var(--bg-color); border-radius: 3px; overflow: hidden; margin-top: 4px;">
                   <div style="height: 100%; width: ${percentage}%; background: var(--primary-color); border-radius: 3px;"></div>
                 </div>
               </div>
             `;
          }).join('')}
        </div>
      </div>
      ` : ''}
      
      <!-- Line Chart -->
      <div class="card" style="position: relative;">
        <div class="flex-between" style="margin-bottom: 15px;">
          <h3 style="font-size: 1rem;">Fluxo de Caixa (Saldo Diário)</h3>
          <select id="select-timeframe" style="width: auto; padding: 4px 8px; font-size: 0.8rem;">
            <option value="30" ${daysToProject === 30 ? 'selected' : ''}>30 Dias</option>
            <option value="60" ${daysToProject === 60 ? 'selected' : ''}>60 Dias</option>
            <option value="90" ${daysToProject === 90 ? 'selected' : ''}>90 Dias</option>
            <option value="120" ${daysToProject === 120 ? 'selected' : ''}>120 Dias</option>
          </select>
        </div>
        
        <div style="width: 100%; overflow: visible; padding-bottom: 10px; position: relative;" id="chart-container">
          <svg width="100%" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none" style="overflow: visible;">
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="var(--primary-color)" />
                <stop offset="100%" stop-color="var(--success-color)" />
              </linearGradient>
              <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--primary-color)" stop-opacity="0.3" />
                <stop offset="100%" stop-color="var(--bg-color)" stop-opacity="0" />
              </linearGradient>
            </defs>
            ${minBal < 0 ? `<line x1="0" y1="${svgHeight - ((0 - minBal) / range) * svgHeight}" x2="${svgWidth}" y2="${svgHeight - ((0 - minBal) / range) * svgHeight}" stroke="var(--danger-color)" stroke-width="1" stroke-dasharray="4" />` : ''}
            <polyline fill="url(#fillGrad)" stroke="none" points="0,${svgHeight} ${points} ${svgWidth},${svgHeight}" />
            <polyline fill="none" stroke="url(#lineGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}" style="filter: drop-shadow(0 4px 6px rgba(99, 102, 241, 0.4));" />
          </svg>
          <div id="chart-tooltip" style="display:none; position:absolute; top: -10px; background: var(--surface-elevated); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; color: white; pointer-events: none; border: 1px solid var(--glass-border); box-shadow: var(--shadow-sm); z-index: 10;"></div>
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-secondary); margin-top: 8px;">
          <span>Hoje</span>
          <span>+${daysToProject / 2}d</span>
          <span>+${daysToProject}d</span>
        </div>
      </div>
      
      <!-- Category Modal Container -->
      <div id="cat-modal-container"></div>
    `;
    
    container.innerHTML = html;
    
    // Timeframe listener
    const selectTimeframe = document.getElementById('select-timeframe');
    if (selectTimeframe) {
      selectTimeframe.addEventListener('change', (e) => {
        daysToProject = parseInt(e.target.value);
        render();
      });
    }
    
    // ✅ FIX: Quitar contas com modal in-app em vez de prompt() nativo
    const btnQuitar = document.getElementById('btn-quitar');
    if (btnQuitar) {
      btnQuitar.addEventListener('click', async () => {
        const { showPrompt, withLoading } = await import('../utils.js');
        const absBalance = Math.abs(u1Balance);
        const valorStr = await showPrompt(
          `💸 ${devedor.nome} deve a ${credor.nome}.\nInsira o valor pago para abater a dívida:`,
          absBalance.toFixed(2)
        );
        
        if (valorStr !== null) {
          let valorPago = parseFloat(String(valorStr).replace(',', '.'));
          if (!isNaN(valorPago) && valorPago > 0) {
            const regraPercent = (credor.id === users[1].id) ? 100 : 0;
            await withLoading(btnQuitar, async () => {
              await db.insert('lancamentos_mes', {
                valor: valorPago,
                data_vencimento: new Date().toISOString().split('T')[0],
                categoria_id: null,
                descricao_custom: 'Acerto de Contas / Transferência',
                tipo_lancamento: 'TRANSFERENCIA',
                pago_por: devedor.id,
                regra_divisao_percent: regraPercent,
                status: 'PAGO'
              });
            });
            render();
          } else {
            alert('Valor inválido!');
          }
        }
      });
    }
    
    // ✅ FIX: Lembretes com modal in-app
    container.querySelectorAll('.btn-lembrete-pay').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { showPrompt, withLoading } = await import('../utils.js');
        const id = btn.dataset.id;
        const oldVal = parseFloat(btn.dataset.val);
        const newValStr = await showPrompt(
          `Valor estimado: ${f.format(oldVal)}\nInsira o valor real pago:`,
          oldVal.toFixed(2)
        );
        if (newValStr !== null) {
          let newVal = parseFloat(String(newValStr).replace(',', '.'));
          if (!isNaN(newVal) && newVal > 0) {
            await withLoading(btn, async () => {
              await db.update('lancamentos_mes', id, { status: 'PAGO', valor: newVal });
            });
            render();
          }
        }
      });
    });
    
    // Category click listener
    container.querySelectorAll('.category-item').forEach(el => {
      el.addEventListener('click', () => {
        const catId = el.dataset.id;
        const catObj = catMap[catId];
        const items = lancamentos.filter(l => l.data_vencimento.startsWith(currentMonthStr) && String(l.categoria_id) === String(catId) && l.tipo_lancamento !== 'RECEITA' && l.tipo_lancamento !== 'TRANSFERENCIA');
        
        const modalHtml = `
          <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px;">
            <div style="background: var(--bg-color); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 20px; width: 100%; max-width: 500px; max-height: 80vh; overflow-y: auto;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                  <span>${catObj?.icone || '❓'}</span>
                  <span>${catObj?.nome || 'Gastos'}</span>
                </h3>
                <button id="btn-close-cat-modal" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">&times;</button>
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${items.length === 0 ? `<p style="color: var(--text-secondary); text-align: center;">Nenhum lançamento encontrado.</p>` : items.map(i => `
                  <div style="background: var(--surface-color); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <div style="font-weight: 600; font-size: 0.9rem;">${i.descricao_custom}</div>
                      <div style="font-size: 0.75rem; color: var(--text-secondary);">${i.data_vencimento.split('-').reverse().join('/')} • ${users.find(u => u.id === i.pago_por)?.nome || 'Sistema'}</div>
                    </div>
                    <div style="font-weight: 700; color: var(--danger-color);">${f.format(i.valor)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
        
        const modContainer = document.getElementById('cat-modal-container');
        modContainer.innerHTML = modalHtml;
        document.getElementById('btn-close-cat-modal').addEventListener('click', () => {
          modContainer.innerHTML = '';
        });
      });
    });
  }

  await render();
}
