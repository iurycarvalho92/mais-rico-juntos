import { db } from '../db.js';
import { f, getCurrentMonthStr, showConfirm, showPrompt, withLoading } from '../utils.js';

export async function renderPlanejamento(container) {
  container.innerHTML = `<div style="text-align: center; padding: 20px;">Carregando...</div>`;
  
  // ✅ FIX: Promise.all em paralelo
  const [objetivos, lancamentos] = await Promise.all([
    db.getTable('objetivos'),
    db.getTable('lancamentos_mes')
  ]);
  
  // ✅ FIX: Filtrar apenas lançamentos do mês atual (antes usava TODOS os meses)
  const currentMonthStr = getCurrentMonthStr();
  
  let receitasPrevistas = 0;
  let custosFixos = 0;
  let gastoVariavel = 0;
  
  for (const l of lancamentos) {
    if (!l.data_vencimento.startsWith(currentMonthStr)) continue; // ✅ FIX
    const val = parseFloat(l.valor);
    if (l.tipo_lancamento === 'RECEITA') {
      receitasPrevistas += val;
    } else if (l.tipo_lancamento === 'DESPESA_FIXA') {
      custosFixos += val;
    } else if (l.tipo_lancamento !== 'TRANSFERENCIA') {
      gastoVariavel += val;
    }
  }
  
  const dinheiroLivre = receitasPrevistas - custosFixos - gastoVariavel;
  const taxaPoupancaMensal = dinheiroLivre > 0 ? dinheiroLivre : 0;
  
  // Generate Projection Chart Data (12 months)
  const chartPoints = [];
  let maxBal = 1;
  let accumulated = 0;
  
  const currentDate = new Date();
  const monthsLabels = [];
  
  for (let m = 0; m < 12; m++) {
    accumulated += taxaPoupancaMensal;
    chartPoints.push(accumulated);
    if (accumulated > maxBal) maxBal = accumulated;
    let d = new Date(currentDate.getFullYear(), currentDate.getMonth() + m, 1);
    monthsLabels.push(d.toLocaleString('pt-BR', { month: 'short' }));
  }
  
  const svgHeight = 150;
  const svgWidth = 300;
  const points = chartPoints.map((val, idx) => {
    const x = (idx / 11) * svgWidth;
    // ✅ FIX: Evitar divisão por zero
    const y = maxBal > 0 ? svgHeight - (val / maxBal) * svgHeight : svgHeight;
    return `${x},${y}`;
  }).join(' ');

  const html = `
    <!-- Resumo de Economias -->
    <div class="card" style="background: rgba(16, 185, 129, 0.1); border-color: var(--success-color);">
      <h3 style="color: var(--success-color); font-size: 1rem; margin-bottom: 5px;">Capacidade de Poupança (Mês Atual)</h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">Com base nos seus gastos deste mês, este é o valor livre projetado.</p>
      <div style="font-size: 1.5rem; font-weight: 700; color: ${dinheiroLivre >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">${f.format(taxaPoupancaMensal)} /mês</div>
      <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 8px;">
        Receitas: ${f.format(receitasPrevistas)} • Fixos: ${f.format(custosFixos)} • Variáveis: ${f.format(gastoVariavel)}
      </div>
    </div>
    
    <!-- Gráfico de Projeção a Longo Prazo -->
    <div class="card">
      <h3 style="margin-bottom: 5px; font-size: 1rem;">Projeção Patrimonial (12 Meses)</h3>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 15px;">Estimativa acumulando o dinheiro livre.</p>
      ${taxaPoupancaMensal === 0 ? `
        <div style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 0.9rem;">
          Sem capacidade de poupança no momento. Configure receitas e reduza despesas.
        </div>
      ` : `
        <div style="width: 100%; overflow-x: auto; padding-bottom: 10px;">
          <svg width="100%" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none" style="overflow: visible;">
            <defs>
              <linearGradient id="projGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="var(--success-color)" />
                <stop offset="100%" stop-color="var(--primary-color)" />
              </linearGradient>
              <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--success-color)" stop-opacity="0.3" />
                <stop offset="100%" stop-color="var(--bg-color)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <polyline fill="url(#projFill)" stroke="none" points="0,${svgHeight} ${points} ${svgWidth},${svgHeight}" />
            <polyline fill="none" stroke="url(#projGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}" style="filter: drop-shadow(0 4px 6px rgba(16, 185, 129, 0.4));" />
          </svg>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-secondary); margin-top: 8px;">
          <span>${monthsLabels[0]}</span>
          <span>${monthsLabels[5]}</span>
          <span>${monthsLabels[11]} (${f.format(accumulated)})</span>
        </div>
      `}
    </div>

    <!-- Lista de Metas (Objetivos) -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="font-size: 1.1rem; margin: 0;">Nossas Metas</h3>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
      ${objetivos.length === 0 ? `<div class="text-muted" style="text-align:center; padding: 10px;">Nenhuma meta definida.</div>` : ''}
      ${objetivos.map(obj => {
        const progresso = Math.min(100, Math.round(((obj.valor_atual || 0) / obj.valor_alvo) * 100));
        const mesesParaAcumular = taxaPoupancaMensal > 0 ? Math.ceil((obj.valor_alvo - (obj.valor_atual || 0)) / taxaPoupancaMensal) : null;
        return `
          <div class="card" style="margin-bottom:0; padding: 15px;">
            <div class="flex-between" style="margin-bottom: 10px;">
              <div style="font-weight: 600;">${obj.titulo}</div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${obj.data_alvo}</div>
                <button class="btn-delete-goal" data-id="${obj.id}" style="background: none; border: none; color: var(--danger-color); cursor: pointer; font-size: 0.8rem;">✕</button>
              </div>
            </div>
            <div class="flex-between" style="font-size: 0.85rem; margin-bottom: 8px;">
              <span style="color: var(--primary-color); font-weight: 600;">${f.format(obj.valor_atual || 0)}</span>
              <span style="color: var(--text-secondary);">Alvo: ${f.format(obj.valor_alvo)}</span>
            </div>
            <div style="width: 100%; height: 8px; background: var(--surface-elevated); border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
              <div style="width: ${progresso}%; height: 100%; background: var(--primary-color); border-radius: 4px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;">
              <span style="color: var(--text-secondary);">${progresso}% concluído</span>
              ${mesesParaAcumular ? `<span style="color: var(--text-secondary);">~${mesesParaAcumular} meses para atingir</span>` : ''}
            </div>
            <!-- ✅ NOVO: Botão depositar na meta -->
            <div style="display: flex; gap: 8px; margin-top: 10px; border-top: 1px solid var(--glass-border); padding-top: 10px;">
              <button class="btn-deposit-goal" data-id="${obj.id}" data-atual="${obj.valor_atual || 0}" class="btn btn-primary" style="flex: 1; padding: 6px; font-size: 0.8rem; background: var(--success-color); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">+ Depositar</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Add Goal Form -->
    <div class="card">
      <h3 style="font-size: 1rem; margin-bottom: 15px;">Adicionar Nova Meta</h3>
      <div class="form-group" style="margin-bottom: 10px;">
        <input type="text" id="goal-title" placeholder="Nome da Meta (ex: Viagem à Europa)" />
      </div>
      <div class="form-group" style="margin-bottom: 10px;">
        <input type="number" id="goal-target" placeholder="Valor Alvo (R$)" />
      </div>
      <div class="form-group" style="margin-bottom: 15px;">
        <label style="display:block; margin-bottom: 5px; font-size: 0.8rem; color: var(--text-secondary);">Data Limite Estimada</label>
        <input type="date" id="goal-date" />
      </div>
      <button id="btn-save-goal" class="btn btn-primary">Salvar Meta</button>
    </div>
  `;
  
  container.innerHTML = html;
  
  // ✅ NOVO: Depositar na meta
  container.querySelectorAll('.btn-deposit-goal').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const atual = parseFloat(btn.dataset.atual);
      const valStr = await showPrompt('Quanto deseja depositar nesta meta? (R$)', '');
      if (valStr !== null) {
        const val = parseFloat(String(valStr).replace(',', '.'));
        if (!isNaN(val) && val > 0) {
          await withLoading(btn, async () => {
            await db.update('objetivos', id, { valor_atual: atual + val });
          });
          renderPlanejamento(container);
        }
      }
    });
  });
  
  // ✅ NOVO: Deletar meta
  container.querySelectorAll('.btn-delete-goal').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await showConfirm('Apagar esta meta?');
      if (confirmed) {
        await db.delete('objetivos', btn.dataset.id);
        renderPlanejamento(container);
      }
    });
  });
  
  document.getElementById('btn-save-goal').addEventListener('click', async () => {
    const titulo = document.getElementById('goal-title').value.trim();
    const valor_alvo = parseFloat(document.getElementById('goal-target').value);
    const data_alvo = document.getElementById('goal-date').value;
    
    if (!titulo || isNaN(valor_alvo) || valor_alvo <= 0 || !data_alvo) {
      alert('Por favor, preencha todos os campos da meta corretamente.');
      return;
    }
    
    await db.insert('objetivos', { titulo, valor_alvo, valor_atual: 0, data_alvo });
    renderPlanejamento(container);
  });
}
