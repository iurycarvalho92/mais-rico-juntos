import { db } from '../db.js';

export async function renderDashboard(container) {
  let daysToProject = 30; // Default view
  
  // Create a closure for re-rendering when timeframe changes
  async function render() {
    container.innerHTML = `<div style="text-align: center; padding: 20px;">Carregando...</div>`;
    
    const lancamentos = await db.getTable('lancamentos_mes');
    const users = await db.getTable('utilizadores');
    const receitas = await db.getTable('receitas_fixas');
    const despesas = await db.getTable('despesas_fixas');
    
    // 1. Calculate Current Month Metrics
    let receitasPrevistas = 0;
    let custosFixos = 0;
    let gastoVariavel = 0;
    
    let u1Balance = 0;
    const u1Id = users[0].id;
    const u2Id = users[1].id;
    
    const currentDate = new Date();
    currentDate.setHours(0,0,0,0);
    const currentMonthStr = currentDate.toISOString().slice(0, 7); // YYYY-MM
    
    // Reminders Array
    const lembretes = [];
    
    for (const l of lancamentos) {
      const val = parseFloat(l.valor);
      
      // Calculate only for current month for the summary cards
      if (l.data_vencimento.startsWith(currentMonthStr)) {
        if (l.tipo_lancamento === 'RECEITA') receitasPrevistas += val;
        else if (l.tipo_lancamento === 'DESPESA_FIXA') custosFixos += val;
        else gastoVariavel += val;
        
        // Balance Logic (Current Month)
        if (l.tipo_lancamento !== 'RECEITA') {
          let u1Share = 0; let u2Share = 0;
          if (l.regra_divisao === '50_50') { u1Share = val / 2; u2Share = val / 2; }
          else if (l.regra_divisao === '100_USER_A') u1Share = val;
          else if (l.regra_divisao === '100_USER_B') u2Share = val;
          
          if (l.pago_por === u1Id) u1Balance += u2Share;
          else if (l.pago_por === u2Id) u1Balance -= u1Share;
        }
      }
      
      // Check for reminders (Pending and within 5 days)
      if (l.status === 'PENDENTE' && l.tipo_lancamento !== 'RECEITA') {
        const vDate = new Date(l.data_vencimento);
        vDate.setHours(0,0,0,0);
        const diffTime = vDate - currentDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= -2 && diffDays <= 5) {
          lembretes.push({ ...l, diffDays });
        }
      }
    }
    
    const dinheiroLivre = receitasPrevistas - custosFixos - gastoVariavel;
    const f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    
    // 2. Future Projection Array
    // Create an array of future dates
    const projectionArray = new Array(daysToProject).fill(0);
    let runningBalance = 0;
    
    // We need to simulate fixed income/expenses into the future
    for (let i = 0; i < daysToProject; i++) {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfMonth = d.getDate();
      
      // Add real 'lancamentos' that exist on this date
      const existents = lancamentos.filter(l => l.data_vencimento === dateStr);
      for (const e of existents) {
        if (e.tipo_lancamento === 'RECEITA') runningBalance += parseFloat(e.valor);
        else runningBalance -= parseFloat(e.valor);
      }
      
      // Simulate future recurring items if they are beyond the current month (since current month is already in 'lancamentos_mes')
      if (d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()) {
        const virtualReceitas = receitas.filter(r => r.dia_recebimento === dayOfMonth);
        const virtualDespesas = despesas.filter(d => d.dia_vencimento === dayOfMonth);
        
        for (const vr of virtualReceitas) runningBalance += parseFloat(vr.valor_estimado);
        for (const vd of virtualDespesas) runningBalance -= parseFloat(vd.valor_estimado);
      }
      
      projectionArray[i] = runningBalance;
    }
    
    // Prepare SVG Points
    let minBal = Math.min(0, ...projectionArray);
    let maxBal = Math.max(10, ...projectionArray);
    const range = maxBal - minBal || 1;
    const svgHeight = 150;
    const svgWidth = 300;
    
    const points = projectionArray.map((val, idx) => {
      const x = (idx / (daysToProject - 1)) * svgWidth;
      const y = svgHeight - ((val - minBal) / range) * svgHeight;
      return `${x},${y}`;
    }).join(' ');

    // Balance Text
    let balanceText = "Vocês estão quites este mês!";
    let balanceColor = "var(--text-secondary)";
    if (Math.abs(u1Balance) > 0.01) {
      if (u1Balance > 0) {
        balanceText = `${users[1]?.nome || 'Usuário 2'} deve ${f.format(Math.abs(u1Balance))} ao ${users[0]?.nome || 'Usuário 1'}`;
        balanceColor = "var(--success-color)";
      } else {
        balanceText = `${users[0]?.nome || 'Usuário 1'} deve ${f.format(Math.abs(u1Balance))} à ${users[1]?.nome || 'Usuário 2'}`;
        balanceColor = "var(--danger-color)";
      }
    }
    
    const html = `
      <!-- Lembretes -->
      ${lembretes.map(lem => `
        <div class="card" style="background: rgba(245, 158, 11, 0.1); border-color: var(--warning-color); padding: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.8rem; color: var(--warning-color); font-weight: 600;">⚠️ Vence em ${lem.diffDays === 0 ? 'Hoje!' : lem.diffDays < 0 ? Math.abs(lem.diffDays) + ' dias atrasado' : lem.diffDays + ' dias'}</div>
            <div style="font-weight: 600;">${lem.descricao_custom}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Projetado: ${f.format(lem.valor)}</div>
          </div>
          <button class="btn btn-primary btn-lembrete-pay" data-id="${lem.id}" data-val="${lem.valor}" style="width: auto; padding: 6px 12px; font-size: 0.8rem; border-radius: 20px;">Pagar / Atualizar</button>
        </div>
      `).join('')}
      
      <!-- Balance Panel -->
      <div class="card" style="text-align: center; border-color: ${balanceColor};">
        <h3 style="color: ${balanceColor};">${balanceText}</h3>
        <p class="text-muted" style="font-size: 0.85rem; margin-top: 5px;">Acerto de contas dinâmico do mês atual</p>
      </div>
      
      <!-- Executive Summary -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
        <div class="card" style="margin:0; padding: 12px;">
          <div style="font-size: 0.75rem; color: var(--text-secondary)">Receitas Mês</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--success-color)">${f.format(receitasPrevistas)}</div>
        </div>
        <div class="card" style="margin:0; padding: 12px;">
          <div style="font-size: 0.75rem; color: var(--text-secondary)">Custos Fixos Mês</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--warning-color)">${f.format(custosFixos)}</div>
        </div>
        <div class="card" style="margin:0; padding: 12px;">
          <div style="font-size: 0.75rem; color: var(--text-secondary)">Gasto Variável Mês</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: var(--danger-color)">${f.format(gastoVariavel)}</div>
        </div>
        <div class="card" style="margin:0; padding: 12px; background: rgba(99, 102, 241, 0.1); border-color: var(--primary-color);">
          <div style="font-size: 0.75rem; color: var(--primary-hover)">Livre (Mês)</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--primary-color)">${f.format(dinheiroLivre)}</div>
        </div>
      </div>
      
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
    `;
    
    container.innerHTML = html;
    
    // Timeframe listener
    document.getElementById('select-timeframe').addEventListener('change', (e) => {
      daysToProject = parseInt(e.target.value);
      render();
    });
    
    // Tooltip logic
    const chartContainer = document.getElementById('chart-container');
    const tooltip = document.getElementById('chart-tooltip');
    
    chartContainer.addEventListener('mousemove', (e) => {
      const rect = chartContainer.getBoundingClientRect();
      let x = e.clientX - rect.left;
      if (x < 0) x = 0;
      if (x > rect.width) x = rect.width;
      
      const percentage = x / rect.width;
      const dataIndex = Math.round(percentage * (daysToProject - 1));
      const val = projectionArray[dataIndex];
      
      const targetDate = new Date(currentDate);
      targetDate.setDate(targetDate.getDate() + dataIndex);
      
      tooltip.innerHTML = `<div>${targetDate.toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}</div><div style="font-weight:bold; color:var(--primary-color);">${f.format(val)}</div>`;
      tooltip.style.left = (x - 40) + 'px';
      tooltip.style.display = 'block';
    });
    
    chartContainer.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
    
    // Lembrete Pagar listener
    container.querySelectorAll('.btn-lembrete-pay').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const oldVal = parseFloat(e.target.dataset.val);
        const newValStr = prompt("O valor estimado era " + f.format(oldVal) + ".\nInsira o valor real final desta fatura (apenas números):", oldVal);
        
        if (newValStr !== null) {
          let newVal = parseFloat(newValStr.replace(',', '.'));
          if (!isNaN(newVal) && newVal > 0) {
            await db.update('lancamentos_mes', id, { status: 'PAGO', valor: newVal });
            render(); // refresh dashboard
          }
        }
      });
    });
  }

  await render();
}
