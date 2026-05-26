import { db } from '../db.js';

export async function renderDashboard(container) {
  container.innerHTML = `<div style="text-align: center; padding: 20px;">A carregar...</div>`;
  
  const lancamentos = await db.getTable('lancamentos_mes');
  const users = await db.getTable('utilizadores');
  
  // 1. Calculate Metrics
  let receitasPrevistas = 0;
  let custosFixos = 0;
  let gastoVariavel = 0;
  
  // 2. Calculate Balance (Splitwise logic)
  // Let's calculate from user1's perspective: positive means user2 owes user1
  let u1Balance = 0;
  const u1Id = users[0].id;
  const u2Id = users[1].id;
  
  // Cashflow projection per day
  const currentDate = new Date();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const dailyFlow = new Array(daysInMonth + 1).fill(0);
  
  for (const l of lancamentos) {
    const val = parseFloat(l.valor);
    const day = parseInt(l.data_vencimento.split('-')[2]);
    
    if (l.tipo_lancamento === 'RECEITA') {
      receitasPrevistas += val;
      dailyFlow[day] += val;
    } else if (l.tipo_lancamento === 'DESPESA_FIXA') {
      custosFixos += val;
      dailyFlow[day] -= val;
    } else {
      gastoVariavel += val;
      dailyFlow[day] -= val;
    }
    
    // Balance Logic
    if (l.tipo_lancamento !== 'RECEITA') {
      let u1Share = 0;
      let u2Share = 0;
      
      if (l.regra_divisao === '50_50') {
        u1Share = val / 2;
        u2Share = val / 2;
      } else if (l.regra_divisao === 'INDIVIDUAL_A' || l.regra_divisao === '100_USER_A') {
        u1Share = val;
      } else if (l.regra_divisao === 'INDIVIDUAL_B' || l.regra_divisao === '100_USER_B') {
        u2Share = val;
      }
      
      // Who paid?
      if (l.pago_por === u1Id) {
        // u1 paid the whole value, but u1's share is u1Share. u1 paid for u2's share.
        // u2 owes u1 their share
        u1Balance += u2Share;
      } else if (l.pago_por === u2Id) {
        u1Balance -= u1Share;
      }
    }
  }
  
  const dinheiroLivre = receitasPrevistas - custosFixos - gastoVariavel;
  
  // Prepare Chart Data
  let acc = 0;
  const chartPoints = [];
  let minBal = 0;
  let maxBal = Math.max(1000, receitasPrevistas); // set some sensible max
  
  for (let d = 1; d <= daysInMonth; d++) {
    acc += dailyFlow[d];
    chartPoints.push(acc);
    if (acc < minBal) minBal = acc;
    if (acc > maxBal) maxBal = acc;
  }
  
  const range = maxBal - minBal || 1;
  const svgHeight = 150;
  const svgWidth = 300;
  const points = chartPoints.map((val, idx) => {
    const x = (idx / (daysInMonth - 1)) * svgWidth;
    const y = svgHeight - ((val - minBal) / range) * svgHeight;
    return `${x},${y}`;
  }).join(' ');
  
  // Formatters
  const f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  
  // Balance Text
  let balanceText = "Vocês estão quites este mês!";
  let balanceColor = "var(--text-secondary)";
  if (Math.abs(u1Balance) > 0.01) {
    if (u1Balance > 0) {
      balanceText = `${users[1].nome} deve ${f.format(Math.abs(u1Balance))} ao ${users[0].nome}`;
      balanceColor = "var(--success-color)";
    } else {
      balanceText = `${users[0].nome} deve ${f.format(Math.abs(u1Balance))} à ${users[1].nome}`;
      balanceColor = "var(--danger-color)";
    }
  }
  
  container.innerHTML = `
    <!-- Balance Panel -->
    <div class="card" style="text-align: center; border-color: ${balanceColor};">
      <h3 style="color: ${balanceColor};">${balanceText}</h3>
      <p class="text-muted" style="font-size: 0.85rem; margin-top: 5px;">Acerto de contas dinâmico</p>
    </div>
    
    <!-- Executive Summary -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
      <div class="card" style="margin:0; padding: 12px;">
        <div style="font-size: 0.75rem; color: var(--text-secondary)">Receitas Previstas</div>
        <div style="font-size: 1.1rem; font-weight: 600; color: var(--success-color)">${f.format(receitasPrevistas)}</div>
      </div>
      <div class="card" style="margin:0; padding: 12px;">
        <div style="font-size: 0.75rem; color: var(--text-secondary)">Custos Fixos</div>
        <div style="font-size: 1.1rem; font-weight: 600; color: var(--warning-color)">${f.format(custosFixos)}</div>
      </div>
      <div class="card" style="margin:0; padding: 12px;">
        <div style="font-size: 0.75rem; color: var(--text-secondary)">Gasto Variável</div>
        <div style="font-size: 1.1rem; font-weight: 600; color: var(--danger-color)">${f.format(gastoVariavel)}</div>
      </div>
      <div class="card" style="margin:0; padding: 12px; background: rgba(99, 102, 241, 0.1); border-color: var(--primary-color);">
        <div style="font-size: 0.75rem; color: var(--primary-hover)">Dinheiro Livre</div>
        <div style="font-size: 1.1rem; font-weight: 700; color: var(--primary-color)">${f.format(dinheiroLivre)}</div>
      </div>
    </div>
    
    <!-- Line Chart -->
    <div class="card">
      <h3 style="margin-bottom: 15px; font-size: 1rem;">Fluxo de Caixa Projetado</h3>
      <div style="width: 100%; overflow-x: auto; padding-bottom: 10px;">
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
          <!-- Zero Line if minBal < 0 -->
          ${minBal < 0 ? `<line x1="0" y1="${svgHeight - ((0 - minBal) / range) * svgHeight}" x2="${svgWidth}" y2="${svgHeight - ((0 - minBal) / range) * svgHeight}" stroke="var(--danger-color)" stroke-width="1" stroke-dasharray="4" />` : ''}
          <polyline fill="url(#fillGrad)" stroke="none" points="0,${svgHeight} ${points} ${svgWidth},${svgHeight}" />
          <polyline fill="none" stroke="url(#lineGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}" style="filter: drop-shadow(0 4px 6px rgba(99, 102, 241, 0.4));" />
        </svg>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-secondary); margin-top: 8px;">
        <span>Dia 1</span>
        <span>Dia 15</span>
        <span>Dia ${daysInMonth}</span>
      </div>
    </div>
  `;
}
